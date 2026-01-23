package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/oapi-codegen/runtime/types"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/excel"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

func (h *Handler) GetOrdersOrderIdTracking(c *gin.Context, orderId types.UUID) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	if strings.EqualFold(claims.Role, "CUSTOMER") {
		order, err := h.OrderStore.GetOrder(c.Request.Context(), uuid.UUID(orderId))
		if err != nil || order.CustomerID != claims.UserID {
			h.writeError(c, http.StatusNotFound, "not_found", "order not found")
			return
		}
	}

	shipments, err := h.TrackingStore.ListTrackingShipments(c.Request.Context(), uuid.UUID(orderId))
	if err != nil {
		h.logError("list tracking shipments failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch tracking")
		return
	}

	response := oapi.TrackingInfo{
		OrderId: orderId,
		Shipments: make([]struct {
			Carrier   *string    `json:"carrier"`
			ShippedAt *time.Time `json:"shippedAt"`
			WaybillNo string     `json:"waybillNo"`
		}, 0, len(shipments)),
	}

	for _, shipment := range shipments {
		response.Shipments = append(response.Shipments, struct {
			Carrier   *string    `json:"carrier"`
			ShippedAt *time.Time `json:"shippedAt"`
			WaybillNo string     `json:"waybillNo"`
		}{
			Carrier:   shipment.Carrier,
			ShippedAt: timeFromTimestamptz(shipment.ShippedAt),
			WaybillNo: shipment.WaybillNo,
		})
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) PostOrdersOrderIdTracking(c *gin.Context, orderId types.UUID) {
	if _, ok := h.requireRole(c, "PROCUREMENT", "ADMIN"); !ok {
		return
	}

	var request oapi.UpdateTrackingRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	shipments := make([]db.OrderTrackingShipment, 0, len(request.Shipments))
	for _, payload := range request.Shipments {
		if strings.TrimSpace(payload.WaybillNo) == "" {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "waybillNo is required")
			return
		}
		var shippedAt pgtype.Timestamptz
		if payload.ShippedAt != nil {
			shippedAt = pgtype.Timestamptz{Time: *payload.ShippedAt, Valid: true}
		}

		shipment, err := h.TrackingStore.UpsertTrackingShipment(c.Request.Context(), db.UpsertTrackingShipmentParams{
			OrderID:   uuid.UUID(orderId),
			WaybillNo: payload.WaybillNo,
			Carrier:   payload.Carrier,
			ShippedAt: shippedAt,
		})
		if err != nil {
			h.logError("upsert tracking shipment failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update tracking")
			return
		}
		shipments = append(shipments, shipment)
	}

	response := oapi.TrackingInfo{
		OrderId: orderId,
		Shipments: make([]struct {
			Carrier   *string    `json:"carrier"`
			ShippedAt *time.Time `json:"shippedAt"`
			WaybillNo string     `json:"waybillNo"`
		}, 0, len(shipments)),
	}

	for _, shipment := range shipments {
		response.Shipments = append(response.Shipments, struct {
			Carrier   *string    `json:"carrier"`
			ShippedAt *time.Time `json:"shippedAt"`
			WaybillNo string     `json:"waybillNo"`
		}{
			Carrier:   shipment.Carrier,
			ShippedAt: timeFromTimestamptz(shipment.ShippedAt),
			WaybillNo: shipment.WaybillNo,
		})
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) PostShipmentsImportJobs(c *gin.Context) {
	claims, ok := h.requireRole(c, "PROCUREMENT", "ADMIN")
	if !ok {
		return
	}

	fileHeader, err := c.FormFile("excelFile")
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "missing file")
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "failed to read file")
		return
	}
	defer func() {
		_ = file.Close()
	}()

	rows, err := excel.ReadRows(file)
	if err != nil {
		h.writeErrorWithDetails(c, http.StatusBadRequest, "invalid_request", "invalid excel file", map[string]interface{}{
			"template": excel.ShipmentImportTemplate().Name,
			"reason":   "invalid_excel",
		})
		return
	}
	if len(rows) <= 1 {
		h.writeErrorWithDetails(c, http.StatusBadRequest, "invalid_request", "no data rows", map[string]interface{}{
			"template": excel.ShipmentImportTemplate().Name,
			"reason":   "no_data_rows",
		})
		return
	}

	spec := excel.ShipmentImportTemplate()
	index := excel.HeaderIndexMap(rows[0])
	missing, missingAny := excel.MissingRequiredHeaders(index, spec)
	if len(missing) > 0 || len(missingAny) > 0 {
		h.writeErrorWithDetails(c, http.StatusBadRequest, "invalid_request", "missing required headers", map[string]interface{}{
			"template":            spec.Name,
			"missingHeaders":      missing,
			"missingHeaderGroups": missingAny,
			"expectedHeaders":     excel.TemplateHeaders(spec),
		})
		return
	}

	var processed int
	rowErrors := make([]map[string]interface{}, 0)
	for i := 1; i < len(rows); i++ {
		row := rows[i]
		rowNo := i + 1
		orderIDRaw := excel.CellValue(row, index, "orderid")
		waybillNo := excel.CellValue(row, index, "waybillno")
		carrier := excel.CellValue(row, index, "carrier")
		shippedAtRaw := excel.CellValue(row, index, "shippedat")

		if orderIDRaw == "" {
			rowErrors = append(rowErrors, map[string]interface{}{
				"rowNo":   rowNo,
				"field":   "orderId",
				"message": "orderId is required",
			})
			continue
		}
		if waybillNo == "" {
			rowErrors = append(rowErrors, map[string]interface{}{
				"rowNo":   rowNo,
				"field":   "waybillNo",
				"message": "waybillNo is required",
			})
			continue
		}
		orderID, err := uuid.Parse(orderIDRaw)
		if err != nil {
			rowErrors = append(rowErrors, map[string]interface{}{
				"rowNo":   rowNo,
				"field":   "orderId",
				"message": "orderId must be a UUID",
			})
			continue
		}

		var shippedAt pgtype.Timestamptz
		if shippedAtRaw != "" {
			if parsed, ok := parseTime(shippedAtRaw); ok {
				shippedAt = pgtype.Timestamptz{Time: parsed, Valid: true}
			} else {
				rowErrors = append(rowErrors, map[string]interface{}{
					"rowNo":   rowNo,
					"field":   "shippedAt",
					"message": "shippedAt must be RFC3339 or YYYY-MM-DD",
				})
				continue
			}
		}

		var carrierPtr *string
		if carrier != "" {
			carrierPtr = &carrier
		}

		if _, err := h.TrackingStore.UpsertTrackingShipment(c.Request.Context(), db.UpsertTrackingShipmentParams{
			OrderID:   orderID,
			WaybillNo: waybillNo,
			Carrier:   carrierPtr,
			ShippedAt: shippedAt,
		}); err != nil {
			h.logError("upsert tracking shipment failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to import shipments")
			return
		}
		processed++
	}

	if processed == 0 {
		h.writeErrorWithDetails(c, http.StatusBadRequest, "invalid_request", "no valid rows", map[string]interface{}{
			"template":  spec.Name,
			"reason":    "no_valid_rows",
			"rowErrors": rowErrors,
		})
		return
	}

	job, err := h.TrackingStore.CreateImportJob(c.Request.Context(), db.CreateImportJobParams{
		Type:            string(oapi.ImportJobTypeSHIPMENTIMPORT),
		Status:          string(oapi.SUCCEEDED),
		Progress:        100,
		ResultFileUrl:   nil,
		ErrorReportUrl:  nil,
		CreatedByUserID: pgtype.UUID{Bytes: claims.UserID, Valid: true},
	})
	if err != nil {
		h.logError("create import job failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to import shipments")
		return
	}

	createdAt := job.CreatedAt.Time
	response := oapi.ImportJob{
		Id:        job.ID,
		Type:      oapi.ImportJobType(job.Type),
		Status:    oapi.JobStatus(job.Status),
		Progress:  int(job.Progress),
		CreatedAt: createdAt,
	}

	c.JSON(http.StatusAccepted, response)
}

func parseTime(value string) (time.Time, bool) {
	parsed, err := time.Parse(time.RFC3339, value)
	if err == nil {
		return parsed, true
	}
	parsed, err = time.Parse("2006-01-02", value)
	if err == nil {
		return parsed, true
	}
	return time.Time{}, false
}
