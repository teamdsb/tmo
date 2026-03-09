package handler

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
)

type miniappDisplayCategory struct {
	Id      string `json:"id"`
	Name    string `json:"name"`
	IconKey string `json:"iconKey"`
	Sort    int    `json:"sort"`
	Enabled bool   `json:"enabled"`
}

type miniappDisplayCategoryListResponse struct {
	Items []miniappDisplayCategory `json:"items"`
}

type putAdminMiniappDisplayCategoryItem struct {
	Id      string `json:"id"`
	Name    string `json:"name"`
	IconKey string `json:"iconKey"`
	Sort    *int   `json:"sort,omitempty"`
	Enabled *bool  `json:"enabled,omitempty"`
}

type putAdminMiniappDisplayCategoriesRequest struct {
	Items []putAdminMiniappDisplayCategoryItem `json:"items"`
}

var defaultMiniappDisplayCategories = []miniappDisplayCategory{
	{Id: "cat-fasteners", Name: "紧固件", IconKey: "setting", Sort: 1, Enabled: true},
	{Id: "cat-electrical", Name: "电气", IconKey: "desktop", Sort: 2, Enabled: true},
	{Id: "cat-ppe", Name: "安全防护", IconKey: "shield", Sort: 3, Enabled: true},
	{Id: "cat-tools", Name: "工具", IconKey: "setting", Sort: 4, Enabled: true},
	{Id: "cat-instrumentation", Name: "仪器仪表", IconKey: "apps", Sort: 5, Enabled: true},
	{Id: "cat-janitorial", Name: "劳保清洁", IconKey: "brush", Sort: 6, Enabled: true},
	{Id: "cat-office", Name: "办公文具", IconKey: "notes", Sort: 7, Enabled: true},
	{Id: "cat-packaging", Name: "包装耗材", IconKey: "apps", Sort: 8, Enabled: true},
}

var displayCategoryIconRules = []struct {
	pattern *regexp.Regexp
	iconKey string
}{
	{pattern: regexp.MustCompile(`办公|文具|office`), iconKey: "notes"},
	{pattern: regexp.MustCompile(`紧固|五金|工业|工具|fasten|bolt|hardware`), iconKey: "setting"},
	{pattern: regexp.MustCompile(`电|电子|electronics?|cable`), iconKey: "desktop"},
	{pattern: regexp.MustCompile(`安防|防护|安全|ppe|safety`), iconKey: "shield"},
	{pattern: regexp.MustCompile(`仪器|仪表|meter|gauge|sensor|instrument`), iconKey: "apps"},
	{pattern: regexp.MustCompile(`清洁|保洁|janitorial`), iconKey: "brush"},
	{pattern: regexp.MustCompile(`包装|胶带|wrap|pack`), iconKey: "apps"},
	{pattern: regexp.MustCompile(`茶|休闲|食品|餐|breakroom|food`), iconKey: "hot"},
}

var allowedDisplayCategoryIcons = map[string]struct{}{
	"notes":   {},
	"setting": {},
	"desktop": {},
	"shield":  {},
	"brush":   {},
	"hot":     {},
	"apps":    {},
}

func (h *Handler) GetCatalogDisplayCategories(c *gin.Context) {
	items, err := h.listMiniappDisplayCategories(c.Request.Context(), false)
	if err != nil {
		h.logError("list miniapp display categories failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list display categories")
		return
	}

	c.JSON(http.StatusOK, miniappDisplayCategoryListResponse{Items: items})
}

func (h *Handler) GetAdminMiniappDisplayCategories(c *gin.Context) {
	if _, ok := h.requireRole(c, "ADMIN"); !ok {
		return
	}

	items, err := h.listMiniappDisplayCategories(c.Request.Context(), true)
	if err != nil {
		h.logError("list admin miniapp display categories failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list display categories")
		return
	}

	c.JSON(http.StatusOK, miniappDisplayCategoryListResponse{Items: items})
}

func (h *Handler) PutAdminMiniappDisplayCategories(c *gin.Context) {
	if _, ok := h.requireRole(c, "ADMIN"); !ok {
		return
	}

	var request putAdminMiniappDisplayCategoriesRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if request.Items == nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "items is required")
		return
	}
	if len(request.Items) > 64 {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "too many display categories")
		return
	}

	normalized := make([]miniappDisplayCategory, 0, len(request.Items))
	seen := make(map[string]struct{}, len(request.Items))
	for index, item := range request.Items {
		next, err := normalizeMiniappDisplayCategoryItem(item, index+1)
		if err != nil {
			h.writeError(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		if _, exists := seen[next.Id]; exists {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "display category id must be unique")
			return
		}
		seen[next.Id] = struct{}{}
		normalized = append(normalized, next)
	}

	sortMiniappDisplayCategories(normalized)
	if err := h.replaceMiniappDisplayCategories(c.Request.Context(), normalized); err != nil {
		h.logError("replace miniapp display categories failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to save display categories")
		return
	}

	c.JSON(http.StatusOK, miniappDisplayCategoryListResponse{Items: normalized})
}

func normalizeMiniappDisplayCategoryItem(item putAdminMiniappDisplayCategoryItem, defaultSort int) (miniappDisplayCategory, error) {
	id := strings.TrimSpace(item.Id)
	if id == "" {
		return miniappDisplayCategory{}, errors.New("display category id is required")
	}
	name := strings.TrimSpace(item.Name)
	if name == "" {
		return miniappDisplayCategory{}, errors.New("display category name is required")
	}

	sortValue := defaultSort
	if item.Sort != nil {
		sortValue = *item.Sort
	}

	enabled := true
	if item.Enabled != nil {
		enabled = *item.Enabled
	}

	iconKey := normalizeDisplayCategoryIcon(item.IconKey, name)
	return miniappDisplayCategory{
		Id:      id,
		Name:    name,
		IconKey: iconKey,
		Sort:    sortValue,
		Enabled: enabled,
	}, nil
}

func normalizeDisplayCategoryIcon(rawIconKey string, name string) string {
	iconKey := strings.ToLower(strings.TrimSpace(rawIconKey))
	if _, ok := allowedDisplayCategoryIcons[iconKey]; !ok {
		iconKey = inferDisplayCategoryIconFromName(name)
	}
	if _, ok := allowedDisplayCategoryIcons[iconKey]; !ok {
		return "apps"
	}
	return iconKey
}

func inferDisplayCategoryIconFromName(name string) string {
	lowerName := strings.ToLower(strings.TrimSpace(name))
	for _, rule := range displayCategoryIconRules {
		if rule.pattern.MatchString(lowerName) {
			return rule.iconKey
		}
	}
	return "apps"
}

func sortMiniappDisplayCategories(items []miniappDisplayCategory) {
	sort.Slice(items, func(i, j int) bool {
		if items[i].Sort == items[j].Sort {
			return strings.Compare(items[i].Id, items[j].Id) < 0
		}
		return items[i].Sort < items[j].Sort
	})
}

func filterEnabledDisplayCategories(items []miniappDisplayCategory) []miniappDisplayCategory {
	result := make([]miniappDisplayCategory, 0, len(items))
	for _, item := range items {
		if item.Enabled {
			result = append(result, item)
		}
	}
	return result
}

func cloneMiniappDisplayCategories(items []miniappDisplayCategory) []miniappDisplayCategory {
	cloned := make([]miniappDisplayCategory, len(items))
	copy(cloned, items)
	return cloned
}

func (h *Handler) listMiniappDisplayCategories(ctx context.Context, includeDisabled bool) ([]miniappDisplayCategory, error) {
	if h.DB == nil {
		return nil, errors.New("database is not configured")
	}

	query := `
SELECT id, name, icon_key, sort, enabled
FROM miniapp_display_categories
`
	if !includeDisabled {
		query += "WHERE enabled = true\n"
	}
	query += "ORDER BY sort ASC, id ASC"

	rows, err := h.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]miniappDisplayCategory, 0)
	for rows.Next() {
		var item miniappDisplayCategory
		if scanErr := rows.Scan(&item.Id, &item.Name, &item.IconKey, &item.Sort, &item.Enabled); scanErr != nil {
			return nil, scanErr
		}
		item.IconKey = normalizeDisplayCategoryIcon(item.IconKey, item.Name)
		items = append(items, item)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		return nil, rowsErr
	}
	if len(items) > 0 {
		return items, nil
	}

	hasRows, err := h.hasMiniappDisplayCategoryRows(ctx)
	if err != nil {
		return nil, err
	}
	if hasRows {
		return items, nil
	}

	fallback := cloneMiniappDisplayCategories(defaultMiniappDisplayCategories)
	if !includeDisabled {
		fallback = filterEnabledDisplayCategories(fallback)
	}
	sortMiniappDisplayCategories(fallback)
	return fallback, nil
}

func (h *Handler) hasMiniappDisplayCategoryRows(ctx context.Context) (bool, error) {
	if h.DB == nil {
		return false, errors.New("database is not configured")
	}

	var exists bool
	if err := h.DB.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM miniapp_display_categories)").Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (h *Handler) replaceMiniappDisplayCategories(ctx context.Context, items []miniappDisplayCategory) error {
	if h.DB == nil {
		return errors.New("database is not configured")
	}

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if _, err := tx.Exec(ctx, "DELETE FROM miniapp_display_categories"); err != nil {
		return err
	}

	const insertQuery = `
INSERT INTO miniapp_display_categories (id, name, icon_key, sort, enabled, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, now(), now())
`
	for _, item := range items {
		if _, err := tx.Exec(ctx, insertQuery, item.Id, item.Name, item.IconKey, item.Sort, item.Enabled); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
