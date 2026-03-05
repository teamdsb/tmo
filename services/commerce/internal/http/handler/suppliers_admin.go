package handler

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type adminSupplierItem struct {
	ID                   string     `json:"id"`
	SupplierCode         string     `json:"supplierCode"`
	Name                 string     `json:"name"`
	Country              string     `json:"country"`
	City                 string     `json:"city"`
	Categories           []string   `json:"categories"`
	Status               string     `json:"status"`
	Score                int        `json:"score"`
	LastQuoteAmountCents *int64     `json:"lastQuoteAmountCents,omitempty"`
	LastQuoteAt          *time.Time `json:"lastQuoteAt,omitempty"`
	PrimaryContactName   string     `json:"primaryContactName"`
	Notes                string     `json:"notes"`
	CreatedAt            time.Time  `json:"createdAt"`
	UpdatedAt            time.Time  `json:"updatedAt"`
}

type adminSupplierListResponse struct {
	Items    []adminSupplierItem `json:"items"`
	Page     int                 `json:"page"`
	PageSize int                 `json:"pageSize"`
	Total    int64               `json:"total"`
}

type adminSupplierContact struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Title     string    `json:"title"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone"`
	IsPrimary bool      `json:"isPrimary"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type adminSupplierContactListResponse struct {
	Items []adminSupplierContact `json:"items"`
}

type adminSupplierScorecard struct {
	ID            string    `json:"id"`
	Period        string    `json:"period"`
	DeliveryScore int       `json:"deliveryScore"`
	QualityScore  int       `json:"qualityScore"`
	PriceScore    int       `json:"priceScore"`
	RiskLevel     string    `json:"riskLevel"`
	CreatedAt     time.Time `json:"createdAt"`
}

type adminSupplierScorecardListResponse struct {
	Items []adminSupplierScorecard `json:"items"`
}

type patchAdminSupplierRequest struct {
	Name       *string   `json:"name"`
	Country    *string   `json:"country"`
	City       *string   `json:"city"`
	Categories *[]string `json:"categories"`
	Status     *string   `json:"status"`
	Score      *int      `json:"score"`
	Notes      *string   `json:"notes"`
}

func (h *Handler) GetAdminSuppliers(c *gin.Context) {
	if _, ok := h.requireRole(c, "SALES", "CS", "MANAGER", "BOSS", "ADMIN"); !ok {
		return
	}
	if h.DB == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "database is not configured")
		return
	}

	page := parseAdminPositiveInt(c.Query("page"), 1)
	pageSize := parseAdminPositiveInt(c.Query("pageSize"), 20)
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	q := strings.TrimSpace(c.Query("q"))
	status := normalizeSupplierStatus(c.Query("status"))
	if status == "" && strings.TrimSpace(c.Query("status")) != "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid status")
		return
	}

	whereParts := []string{"1=1"}
	args := make([]interface{}, 0, 8)
	if q != "" {
		args = append(args, "%"+q+"%")
		placeholder := fmt.Sprintf("$%d", len(args))
		whereParts = append(whereParts, "(s.name ILIKE "+placeholder+" OR s.supplier_code ILIKE "+placeholder+")")
	}
	if status != "" {
		args = append(args, status)
		placeholder := fmt.Sprintf("$%d", len(args))
		whereParts = append(whereParts, "s.status = "+placeholder)
	}

	whereSQL := strings.Join(whereParts, " AND ")
	countSQL := "SELECT COUNT(1) FROM admin_suppliers s WHERE " + whereSQL

	var total int64
	if err := h.DB.QueryRow(c.Request.Context(), countSQL, args...).Scan(&total); err != nil {
		h.logError("count admin suppliers failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list suppliers")
		return
	}

	args = append(args, pageSize, offset)
	limitArg := fmt.Sprintf("$%d", len(args)-1)
	offsetArg := fmt.Sprintf("$%d", len(args))
	listSQL := `
SELECT
  s.id,
  s.supplier_code,
  s.name,
  s.country,
  s.city,
  s.categories,
  s.status,
  s.score,
  s.last_quote_amount_cents,
  s.last_quote_at,
  COALESCE(pc.name, '') AS primary_contact_name,
  s.notes,
  s.created_at,
  s.updated_at
FROM admin_suppliers s
LEFT JOIN LATERAL (
  SELECT c.name
  FROM admin_supplier_contacts c
  WHERE c.supplier_id = s.id
  ORDER BY c.is_primary DESC, c.updated_at DESC, c.id ASC
  LIMIT 1
) pc ON true
WHERE ` + whereSQL + `
ORDER BY s.updated_at DESC, s.id DESC
LIMIT ` + limitArg + ` OFFSET ` + offsetArg

	rows, err := h.DB.Query(c.Request.Context(), listSQL, args...)
	if err != nil {
		h.logError("list admin suppliers failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list suppliers")
		return
	}
	defer rows.Close()

	items := make([]adminSupplierItem, 0)
	for rows.Next() {
		item, scanErr := scanAdminSupplierItem(rows)
		if scanErr != nil {
			h.logError("scan admin supplier failed", scanErr)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list suppliers")
			return
		}
		items = append(items, item)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		h.logError("iterate admin suppliers failed", rowsErr)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list suppliers")
		return
	}

	c.JSON(http.StatusOK, adminSupplierListResponse{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	})
}

func (h *Handler) GetAdminSuppliersSupplierId(c *gin.Context) {
	if _, ok := h.requireRole(c, "SALES", "CS", "MANAGER", "BOSS", "ADMIN"); !ok {
		return
	}

	supplierID, ok := parseSupplierID(c, h)
	if !ok {
		return
	}

	item, err := h.fetchAdminSupplier(c.Request.Context(), supplierID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "supplier not found")
			return
		}
		h.logError("get admin supplier failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch supplier")
		return
	}

	c.JSON(http.StatusOK, item)
}

func (h *Handler) PatchAdminSuppliersSupplierId(c *gin.Context) {
	if _, ok := h.requireRole(c, "MANAGER", "BOSS", "ADMIN"); !ok {
		return
	}
	if h.DB == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "database is not configured")
		return
	}

	supplierID, ok := parseSupplierID(c, h)
	if !ok {
		return
	}

	var request patchAdminSupplierRequest
	fields, err := decodeJSONFields(c, &request)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if len(fields) == 0 {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "request body is required")
		return
	}

	setClauses := make([]string, 0, 8)
	args := make([]interface{}, 0, 8)

	if hasJSONField(fields, "name") {
		if request.Name == nil || strings.TrimSpace(*request.Name) == "" {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "name cannot be empty")
			return
		}
		args = append(args, strings.TrimSpace(*request.Name))
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", len(args)))
	}

	if hasJSONField(fields, "country") {
		if request.Country == nil {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "country cannot be null")
			return
		}
		args = append(args, strings.TrimSpace(*request.Country))
		setClauses = append(setClauses, fmt.Sprintf("country = $%d", len(args)))
	}

	if hasJSONField(fields, "city") {
		if request.City == nil {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "city cannot be null")
			return
		}
		args = append(args, strings.TrimSpace(*request.City))
		setClauses = append(setClauses, fmt.Sprintf("city = $%d", len(args)))
	}

	if hasJSONField(fields, "categories") {
		if request.Categories == nil {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "categories cannot be null")
			return
		}
		args = append(args, normalizeSupplierCategories(*request.Categories))
		setClauses = append(setClauses, fmt.Sprintf("categories = $%d", len(args)))
	}

	if hasJSONField(fields, "status") {
		if request.Status == nil {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "status cannot be null")
			return
		}
		status := normalizeSupplierStatus(*request.Status)
		if status == "" {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid status")
			return
		}
		args = append(args, status)
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", len(args)))
	}

	if hasJSONField(fields, "score") {
		if request.Score == nil {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "score cannot be null")
			return
		}
		if *request.Score < 0 || *request.Score > 100 {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "score must be between 0 and 100")
			return
		}
		args = append(args, *request.Score)
		setClauses = append(setClauses, fmt.Sprintf("score = $%d", len(args)))
	}

	if hasJSONField(fields, "notes") {
		if request.Notes == nil {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "notes cannot be null")
			return
		}
		args = append(args, strings.TrimSpace(*request.Notes))
		setClauses = append(setClauses, fmt.Sprintf("notes = $%d", len(args)))
	}

	if len(setClauses) == 0 {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "no updatable fields found")
		return
	}

	setClauses = append(setClauses, "updated_at = now()")
	args = append(args, supplierID)
	whereArg := fmt.Sprintf("$%d", len(args))

	query := `
UPDATE admin_suppliers
SET ` + strings.Join(setClauses, ", ") + `
WHERE id = ` + whereArg + `
RETURNING
  id,
  supplier_code,
  name,
  country,
  city,
  categories,
  status,
  score,
  last_quote_amount_cents,
  last_quote_at,
  notes,
  created_at,
  updated_at
`

	var (
		id                   uuid.UUID
		supplierCode         string
		name                 string
		country              string
		city                 string
		categories           []string
		status               string
		score                int
		lastQuoteAmountCents sql.NullInt64
		lastQuoteAt          sql.NullTime
		notes                string
		createdAt            time.Time
		updatedAt            time.Time
	)
	if err := h.DB.QueryRow(c.Request.Context(), query, args...).Scan(
		&id,
		&supplierCode,
		&name,
		&country,
		&city,
		&categories,
		&status,
		&score,
		&lastQuoteAmountCents,
		&lastQuoteAt,
		&notes,
		&createdAt,
		&updatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "supplier not found")
			return
		}
		h.logError("patch admin supplier failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update supplier")
		return
	}

	primaryContactName := ""
	if err := h.DB.QueryRow(
		c.Request.Context(),
		`SELECT COALESCE(name, '') FROM admin_supplier_contacts WHERE supplier_id = $1 ORDER BY is_primary DESC, updated_at DESC, id ASC LIMIT 1`,
		supplierID,
	).Scan(&primaryContactName); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		h.logError("load supplier contact failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update supplier")
		return
	}

	c.JSON(http.StatusOK, adminSupplierItem{
		ID:                 id.String(),
		SupplierCode:       supplierCode,
		Name:               name,
		Country:            country,
		City:               city,
		Categories:         categories,
		Status:             status,
		Score:              score,
		PrimaryContactName: primaryContactName,
		Notes:              notes,
		CreatedAt:          createdAt,
		UpdatedAt:          updatedAt,
		LastQuoteAmountCents: func() *int64 {
			if !lastQuoteAmountCents.Valid {
				return nil
			}
			value := lastQuoteAmountCents.Int64
			return &value
		}(),
		LastQuoteAt: func() *time.Time {
			if !lastQuoteAt.Valid {
				return nil
			}
			value := lastQuoteAt.Time
			return &value
		}(),
	})
}

func (h *Handler) GetAdminSuppliersSupplierIdContacts(c *gin.Context) {
	if _, ok := h.requireRole(c, "SALES", "CS", "MANAGER", "BOSS", "ADMIN"); !ok {
		return
	}
	if h.DB == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "database is not configured")
		return
	}

	supplierID, ok := parseSupplierID(c, h)
	if !ok {
		return
	}
	if err := h.ensureSupplierExists(c.Request.Context(), supplierID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "supplier not found")
			return
		}
		h.logError("check supplier exists failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch supplier contacts")
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
SELECT id, name, title, COALESCE(email, ''), COALESCE(phone, ''), is_primary, updated_at
FROM admin_supplier_contacts
WHERE supplier_id = $1
ORDER BY is_primary DESC, updated_at DESC, id ASC
`, supplierID)
	if err != nil {
		h.logError("list supplier contacts failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch supplier contacts")
		return
	}
	defer rows.Close()

	items := make([]adminSupplierContact, 0)
	for rows.Next() {
		var item adminSupplierContact
		var id uuid.UUID
		if err := rows.Scan(&id, &item.Name, &item.Title, &item.Email, &item.Phone, &item.IsPrimary, &item.UpdatedAt); err != nil {
			h.logError("scan supplier contact failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch supplier contacts")
			return
		}
		item.ID = id.String()
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		h.logError("iterate supplier contacts failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch supplier contacts")
		return
	}

	c.JSON(http.StatusOK, adminSupplierContactListResponse{Items: items})
}

func (h *Handler) GetAdminSuppliersSupplierIdScorecards(c *gin.Context) {
	if _, ok := h.requireRole(c, "SALES", "CS", "MANAGER", "BOSS", "ADMIN"); !ok {
		return
	}
	if h.DB == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "database is not configured")
		return
	}

	supplierID, ok := parseSupplierID(c, h)
	if !ok {
		return
	}
	if err := h.ensureSupplierExists(c.Request.Context(), supplierID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "supplier not found")
			return
		}
		h.logError("check supplier exists failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch supplier scorecards")
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
SELECT id, period, delivery_score, quality_score, price_score, risk_level, created_at
FROM admin_supplier_scorecards
WHERE supplier_id = $1
ORDER BY period DESC, id DESC
`, supplierID)
	if err != nil {
		h.logError("list supplier scorecards failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch supplier scorecards")
		return
	}
	defer rows.Close()

	items := make([]adminSupplierScorecard, 0)
	for rows.Next() {
		var item adminSupplierScorecard
		var id uuid.UUID
		if err := rows.Scan(&id, &item.Period, &item.DeliveryScore, &item.QualityScore, &item.PriceScore, &item.RiskLevel, &item.CreatedAt); err != nil {
			h.logError("scan supplier scorecard failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch supplier scorecards")
			return
		}
		item.ID = id.String()
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		h.logError("iterate supplier scorecards failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch supplier scorecards")
		return
	}

	c.JSON(http.StatusOK, adminSupplierScorecardListResponse{Items: items})
}

func parseSupplierID(c *gin.Context, h *Handler) (uuid.UUID, bool) {
	if h.DB == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "database is not configured")
		return uuid.Nil, false
	}
	supplierID, err := uuid.Parse(strings.TrimSpace(c.Param("supplierId")))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid supplierId")
		return uuid.Nil, false
	}
	return supplierID, true
}

func (h *Handler) ensureSupplierExists(ctx context.Context, supplierID uuid.UUID) error {
	if h.DB == nil {
		return errors.New("database is not configured")
	}

	var exists bool
	if err := h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM admin_suppliers WHERE id = $1)`, supplierID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return pgx.ErrNoRows
	}
	return nil
}

func (h *Handler) fetchAdminSupplier(ctx context.Context, supplierID uuid.UUID) (adminSupplierItem, error) {
	if h.DB == nil {
		return adminSupplierItem{}, errors.New("database is not configured")
	}

	rows, err := h.DB.Query(ctx, `
SELECT
  s.id,
  s.supplier_code,
  s.name,
  s.country,
  s.city,
  s.categories,
  s.status,
  s.score,
  s.last_quote_amount_cents,
  s.last_quote_at,
  COALESCE(pc.name, '') AS primary_contact_name,
  s.notes,
  s.created_at,
  s.updated_at
FROM admin_suppliers s
LEFT JOIN LATERAL (
  SELECT c.name
  FROM admin_supplier_contacts c
  WHERE c.supplier_id = s.id
  ORDER BY c.is_primary DESC, c.updated_at DESC, c.id ASC
  LIMIT 1
) pc ON true
WHERE s.id = $1
`, supplierID)
	if err != nil {
		return adminSupplierItem{}, err
	}
	defer rows.Close()

	if !rows.Next() {
		if rows.Err() != nil {
			return adminSupplierItem{}, rows.Err()
		}
		return adminSupplierItem{}, pgx.ErrNoRows
	}

	item, err := scanAdminSupplierItem(rows)
	if err != nil {
		return adminSupplierItem{}, err
	}
	return item, nil
}

func parseAdminPositiveInt(raw string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func normalizeSupplierStatus(raw string) string {
	status := strings.ToUpper(strings.TrimSpace(raw))
	switch status {
	case "ACTIVE", "PAUSED", "TERMINATED":
		return status
	default:
		return ""
	}
}

func normalizeSupplierCategories(categories []string) []string {
	if len(categories) == 0 {
		return []string{}
	}
	seen := make(map[string]struct{}, len(categories))
	result := make([]string, 0, len(categories))
	for _, item := range categories {
		normalized := strings.TrimSpace(item)
		if normalized == "" {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}
	return result
}

func scanAdminSupplierItem(rows pgx.Rows) (adminSupplierItem, error) {
	var (
		id                   uuid.UUID
		supplierCode         string
		name                 string
		country              string
		city                 string
		categories           []string
		status               string
		score                int
		lastQuoteAmountCents sql.NullInt64
		lastQuoteAt          sql.NullTime
		primaryContactName   string
		notes                string
		createdAt            time.Time
		updatedAt            time.Time
	)
	if err := rows.Scan(
		&id,
		&supplierCode,
		&name,
		&country,
		&city,
		&categories,
		&status,
		&score,
		&lastQuoteAmountCents,
		&lastQuoteAt,
		&primaryContactName,
		&notes,
		&createdAt,
		&updatedAt,
	); err != nil {
		return adminSupplierItem{}, err
	}

	item := adminSupplierItem{
		ID:                 id.String(),
		SupplierCode:       supplierCode,
		Name:               name,
		Country:            country,
		City:               city,
		Categories:         categories,
		Status:             status,
		Score:              score,
		PrimaryContactName: primaryContactName,
		Notes:              notes,
		CreatedAt:          createdAt,
		UpdatedAt:          updatedAt,
	}
	if lastQuoteAmountCents.Valid {
		value := lastQuoteAmountCents.Int64
		item.LastQuoteAmountCents = &value
	}
	if lastQuoteAt.Valid {
		value := lastQuoteAt.Time
		item.LastQuoteAt = &value
	}
	return item, nil
}
