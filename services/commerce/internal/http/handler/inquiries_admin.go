package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type requirementProfileResponse struct {
	RequirementNo   string   `json:"requirementNo"`
	Title           string   `json:"title"`
	CompanyName     string   `json:"companyName"`
	ContactName     string   `json:"contactName"`
	ContactPhone    string   `json:"contactPhone"`
	ExpectedQty     string   `json:"expectedQty"`
	TargetUnitPrice string   `json:"targetUnitPrice"`
	Priority        string   `json:"priority"`
	Source          string   `json:"source"`
	Summary         string   `json:"summary"`
	Attachments     []string `json:"attachments"`
}

func (h *Handler) GetAdminInquiriesInquiryIdRequirementProfile(c *gin.Context) {
	if _, ok := h.requireRole(c, "SALES", "CS", "MANAGER", "BOSS", "ADMIN"); !ok {
		return
	}

	inquiryID, err := uuid.Parse(strings.TrimSpace(c.Param("inquiryId")))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid inquiryId")
		return
	}

	inquiry, err := h.InquiryStore.GetPriceInquiry(c.Request.Context(), inquiryID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "inquiry not found")
			return
		}
		h.logError("get price inquiry failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch requirement profile")
		return
	}

	title := "询价需求 " + shortID(inquiry.ID)
	if inquiry.SkuID.Valid {
		skus, err := h.CatalogStore.ListSkusByIDs(c.Request.Context(), []uuid.UUID{inquiry.SkuID.Bytes})
		if err != nil {
			h.logError("list sku failed for requirement profile", err)
		} else if len(skus) > 0 {
			title = strings.TrimSpace(skus[0].Name)
			if title == "" {
				title = "询价需求 " + shortID(inquiry.ID)
			}
		}
	}

	expectedQty := "待确认"
	if inquiry.OrderID.Valid {
		orderItems, err := h.OrderStore.ListOrderItems(c.Request.Context(), inquiry.OrderID.Bytes)
		if err != nil {
			h.logError("list order items failed for requirement profile", err)
		} else if len(orderItems) > 0 {
			totalQty := 0
			for _, item := range orderItems {
				totalQty += int(item.Qty)
			}
			if totalQty > 0 {
				expectedQty = strconv.Itoa(totalQty)
			}
		}
	}

	source := "需求链接"
	if inquiry.OrderID.Valid {
		source = "订单关联"
	}

	response := requirementProfileResponse{
		RequirementNo:   "REQ-" + strings.ToUpper(shortID(inquiry.ID)),
		Title:           title,
		CompanyName:     "客户 " + shortID(inquiry.CreatedByUserID),
		ContactName:     "待补充",
		ContactPhone:    "待补充",
		ExpectedQty:     expectedQty,
		TargetUnitPrice: "待确认",
		Priority:        inquiryPriority(inquiry.Status),
		Source:          source,
		Summary:         strings.TrimSpace(inquiry.Message),
		Attachments:     []string{},
	}
	if response.Summary == "" {
		response.Summary = "暂无补充说明"
	}

	c.JSON(http.StatusOK, response)
}

func inquiryPriority(status string) string {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "OPEN":
		return "高"
	case "RESPONDED":
		return "中"
	default:
		return "低"
	}
}

func shortID(value uuid.UUID) string {
	trimmed := strings.ReplaceAll(value.String(), "-", "")
	if len(trimmed) <= 8 {
		return trimmed
	}
	return trimmed[:8]
}
