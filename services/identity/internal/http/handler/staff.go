package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/oapi-codegen/runtime/types"

	shareddb "github.com/teamdsb/tmo/packages/go-shared/db"
	"github.com/teamdsb/tmo/services/identity/internal/db"
	"github.com/teamdsb/tmo/services/identity/internal/http/oapi"
)

const defaultStaffBindingTTL = 30 * time.Minute

func (h *Handler) PostStaff(c *gin.Context) {
	claims, ok := h.requireAdmin(c)
	if !ok {
		return
	}

	var request oapi.CreateStaffRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	roles := normalizeRoles(request.Roles)
	if len(roles) == 0 {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "roles is required")
		return
	}
	for _, role := range roles {
		if !isStaffRole(role) {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid staff role")
			return
		}
	}

	var created db.User
	err := shareddb.WithTx(c.Request.Context(), h.DB, func(tx pgx.Tx) error {
		q := h.Store.WithTx(tx)
		userID := uuid.New()
		createdUser, err := q.CreateUser(c.Request.Context(), db.CreateUserParams{
			ID:               userID,
			DisplayName:      request.DisplayName,
			Phone:            nil,
			UserType:         "staff",
			OwnerSalesUserID: pgtype.UUID{},
		})
		if err != nil {
			return err
		}
		for _, role := range roles {
			if err := q.AddUserRole(c.Request.Context(), db.AddUserRoleParams{
				UserID: userID,
				Role:   role,
			}); err != nil {
				return err
			}
		}
		created = createdUser
		return nil
	})
	if err != nil {
		h.logError("create staff failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create staff")
		return
	}

	h.recordAudit(c, &claims.UserID, "staff.create", "staff", &created.ID, map[string]interface{}{
		"roles": roles,
	})

	c.JSON(http.StatusCreated, staffFromModel(created, roles))
}

func (h *Handler) GetStaff(c *gin.Context, params oapi.GetStaffParams) {
	if _, ok := h.requireAdmin(c); !ok {
		return
	}

	page := 1
	pageSize := 20
	if params.Page != nil && *params.Page > 0 {
		page = *params.Page
	}
	if params.PageSize != nil && *params.PageSize > 0 {
		pageSize = *params.PageSize
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	users, err := h.Store.ListStaffUsers(c.Request.Context(), db.ListStaffUsersParams{
		Limit:  int32(pageSize),
		Offset: int32(offset),
	})
	if err != nil {
		h.logError("list staff failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list staff")
		return
	}

	total, err := h.Store.CountStaffUsers(c.Request.Context())
	if err != nil {
		h.logError("count staff failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list staff")
		return
	}

	items := make([]oapi.StaffUser, 0, len(users))
	for _, user := range users {
		roles, err := h.Store.ListUserRoles(c.Request.Context(), user.ID)
		if err != nil {
			h.logError("list staff roles failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list staff")
			return
		}
		items = append(items, staffFromModel(user, normalizeRoles(roles)))
	}

	c.JSON(http.StatusOK, oapi.PagedStaffList{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) GetStaffStaffId(c *gin.Context, staffId types.UUID) {
	if _, ok := h.requireAdmin(c); !ok {
		return
	}

	user, err := h.Store.GetUserByID(c.Request.Context(), uuid.UUID(staffId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "staff not found")
			return
		}
		h.logError("get staff failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch staff")
		return
	}
	if strings.ToLower(user.UserType) != "staff" {
		h.writeError(c, http.StatusNotFound, "not_found", "staff not found")
		return
	}

	roles, err := h.Store.ListUserRoles(c.Request.Context(), user.ID)
	if err != nil {
		h.logError("list staff roles failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch staff")
		return
	}

	c.JSON(http.StatusOK, staffFromModel(user, normalizeRoles(roles)))
}

func (h *Handler) PatchStaffStaffId(c *gin.Context, staffId types.UUID) {
	claims, ok := h.requireAdmin(c)
	if !ok {
		return
	}

	var request oapi.UpdateStaffRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	user, err := h.Store.GetUserByID(c.Request.Context(), uuid.UUID(staffId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "staff not found")
			return
		}
		h.logError("get staff failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update staff")
		return
	}
	if strings.ToLower(user.UserType) != "staff" {
		h.writeError(c, http.StatusNotFound, "not_found", "staff not found")
		return
	}

	roles := []string{}
	if request.Roles != nil {
		roles = normalizeRoles(*request.Roles)
		if len(roles) == 0 {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "roles is required")
			return
		}
		for _, role := range roles {
			if !isStaffRole(role) {
				h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid staff role")
				return
			}
		}
	}

	status := ""
	var disabledAt pgtype.Timestamptz
	var disabledReason *string
	if request.Status != nil {
		status = strings.ToLower(string(*request.Status))
		switch status {
		case "active":
			disabledAt = pgtype.Timestamptz{}
			disabledReason = nil
		case "disabled":
			disabledAt = pgtype.Timestamptz{Time: time.Now(), Valid: true}
			disabledReason = request.DisabledReason
		default:
			h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid status")
			return
		}
	}

	err = shareddb.WithTx(c.Request.Context(), h.DB, func(tx pgx.Tx) error {
		q := h.Store.WithTx(tx)
		if request.DisplayName != nil {
			if _, err := q.UpdateUserProfile(c.Request.Context(), db.UpdateUserProfileParams{
				ID:          user.ID,
				DisplayName: request.DisplayName,
			}); err != nil {
				return err
			}
		}
		if status != "" {
			if _, err := q.UpdateUserStatus(c.Request.Context(), db.UpdateUserStatusParams{
				ID:             user.ID,
				Status:         status,
				DisabledAt:     disabledAt,
				DisabledReason: disabledReason,
			}); err != nil {
				return err
			}
		}
		if request.Roles != nil {
			if err := q.DeleteUserRoles(c.Request.Context(), user.ID); err != nil {
				return err
			}
			for _, role := range roles {
				if err := q.AddUserRole(c.Request.Context(), db.AddUserRoleParams{
					UserID: user.ID,
					Role:   role,
				}); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		h.logError("update staff failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update staff")
		return
	}

	updated, err := h.Store.GetUserByID(c.Request.Context(), user.ID)
	if err != nil {
		h.logError("reload staff failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update staff")
		return
	}
	currentRoles, err := h.Store.ListUserRoles(c.Request.Context(), updated.ID)
	if err != nil {
		h.logError("list staff roles failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update staff")
		return
	}

	h.recordAudit(c, &claims.UserID, "staff.update", "staff", &updated.ID, map[string]interface{}{
		"roles":  normalizeRoles(currentRoles),
		"status": updated.Status,
	})

	c.JSON(http.StatusOK, staffFromModel(updated, normalizeRoles(currentRoles)))
}

func (h *Handler) PostStaffStaffIdBindings(c *gin.Context, staffId types.UUID) {
	claims, ok := h.requireAdmin(c)
	if !ok {
		return
	}

	var request oapi.CreateStaffBindingRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	platformName := strings.TrimSpace(string(request.Platform))
	if platformName == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "platform is required")
		return
	}
	if platformName != "weapp" && platformName != "alipay" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid platform")
		return
	}

	user, err := h.Store.GetUserByID(c.Request.Context(), uuid.UUID(staffId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "staff not found")
			return
		}
		h.logError("get staff failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create binding")
		return
	}
	if strings.ToLower(user.UserType) != "staff" {
		h.writeError(c, http.StatusNotFound, "not_found", "staff not found")
		return
	}

	expiresIn := defaultStaffBindingTTL
	if request.ExpiresIn != nil && *request.ExpiresIn > 0 {
		expiresIn = time.Duration(*request.ExpiresIn) * time.Second
	}
	expiresAt := time.Now().Add(expiresIn)

	token := uuid.NewString()
	record, err := h.Store.CreateStaffBindingToken(c.Request.Context(), db.CreateStaffBindingTokenParams{
		Token:       token,
		StaffUserID: user.ID,
		Platform:    platformName,
		ExpiresAt: pgtype.Timestamptz{
			Time:  expiresAt,
			Valid: true,
		},
		CreatedBy: pgtype.UUID{Bytes: claims.UserID, Valid: true},
	})
	if err != nil {
		h.logError("create binding token failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create binding")
		return
	}

	h.recordAudit(c, &claims.UserID, "staff.binding.create", "staff", &user.ID, map[string]interface{}{
		"platform": platformName,
	})

	response := oapi.StaffBindingToken{
		Token: token,
	}
	if record.ExpiresAt.Valid {
		expires := record.ExpiresAt.Time
		response.ExpiresAt = &expires
	}
	c.JSON(http.StatusCreated, response)
}

func staffFromModel(user db.User, roles []string) oapi.StaffUser {
	response := oapi.StaffUser{
		Id:        types.UUID(user.ID),
		Roles:     roles,
		Status:    oapi.UserStatus(user.Status),
		CreatedAt: user.CreatedAt.Time,
		UpdatedAt: user.UpdatedAt.Time,
	}
	if user.DisplayName != nil {
		response.DisplayName = user.DisplayName
	}
	if user.DisabledAt.Valid {
		disabledAt := user.DisabledAt.Time
		response.DisabledAt = &disabledAt
	}
	if user.DisabledReason != nil {
		response.DisabledReason = user.DisabledReason
	}
	return response
}

func isStaffRole(role string) bool {
	switch strings.ToUpper(role) {
	case "SALES", "PROCUREMENT", "CS":
		return true
	default:
		return false
	}
}
