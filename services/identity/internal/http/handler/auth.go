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
	"golang.org/x/crypto/bcrypt"

	shareddb "github.com/teamdsb/tmo/packages/go-shared/db"
	"github.com/teamdsb/tmo/services/identity/internal/db"
	"github.com/teamdsb/tmo/services/identity/internal/http/oapi"
)

func (h *Handler) PostAuthMiniLogin(c *gin.Context) {
	if h.Store == nil || h.Auth == nil || h.Platform == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "service not ready")
		return
	}

	var request oapi.MiniLoginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if strings.TrimSpace(request.Code) == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "code is required")
		return
	}

	platformName := strings.ToLower(strings.TrimSpace(string(request.Platform)))
	identity, err := h.Platform.Resolve(c.Request.Context(), platformName, request.Code)
	if err != nil {
		h.logError("resolve mini login failed", err)
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid login code")
		return
	}

	user, err := h.Store.GetUserByIdentity(c.Request.Context(), db.GetUserByIdentityParams{
		Provider:       platformName,
		ProviderUserID: identity.ProviderUserID,
	})

	var roles []string
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			h.logError("lookup identity failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
			return
		}

		bindingToken := ""
		if request.BindingToken != nil {
			bindingToken = strings.TrimSpace(*request.BindingToken)
		}
		if bindingToken != "" {
			boundUser, boundRoles, bindErr := h.bindStaffIdentity(c, platformName, identity.ProviderUserID, identity.UnionID, bindingToken)
			if bindErr != nil {
				return
			}
			user = boundUser
			roles = boundRoles
		} else {
			requestedRole := ""
			if request.Role != nil {
				requestedRole = strings.ToUpper(string(*request.Role))
			}
			if requestedRole != "" && requestedRole != "CUSTOMER" {
				h.writeError(c, http.StatusBadRequest, "invalid_request", "role not allowed")
				return
			}

			var createdUser db.User
			var unionID *string
			if strings.TrimSpace(identity.UnionID) != "" {
				unionID = &identity.UnionID
			}
			err = shareddb.WithTx(c.Request.Context(), h.DB, func(tx pgx.Tx) error {
				q := h.Store.WithTx(tx)
				newUser, err := q.CreateUser(c.Request.Context(), db.CreateUserParams{
					ID:               uuid.New(),
					DisplayName:      nil,
					UserType:         "customer",
					OwnerSalesUserID: pgtype.UUID{},
				})
				if err != nil {
					return err
				}
				if err := q.AddUserRole(c.Request.Context(), db.AddUserRoleParams{
					UserID: newUser.ID,
					Role:   "CUSTOMER",
				}); err != nil {
					return err
				}
				if _, err := q.CreateUserIdentity(c.Request.Context(), db.CreateUserIdentityParams{
					ID:              uuid.New(),
					Provider:        platformName,
					ProviderUserID:  identity.ProviderUserID,
					ProviderUnionID: unionID,
					UserID:          newUser.ID,
				}); err != nil {
					return err
				}
				createdUser = newUser
				return nil
			})
			if err != nil {
				if shareddb.IsUniqueViolation(err) {
					h.writeError(c, http.StatusConflict, "conflict", "identity already bound")
					return
				}
				h.logError("create user failed", err)
				h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
				return
			}
			user = createdUser
			roles = []string{"CUSTOMER"}
		}
	} else {
		if request.BindingToken != nil && strings.TrimSpace(*request.BindingToken) != "" {
			h.writeError(c, http.StatusConflict, "conflict", "identity already bound")
			return
		}
		roles, err = h.Store.ListUserRoles(c.Request.Context(), user.ID)
		if err != nil {
			h.logError("list roles failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
			return
		}
	}

	roles = normalizeRoles(roles)
	if len(roles) == 0 {
		h.writeError(c, http.StatusUnauthorized, "unauthorized", "no roles assigned")
		return
	}
	if user.Status == "disabled" {
		h.writeError(c, http.StatusForbidden, "forbidden", "account disabled")
		return
	}

	selectedRole, ok := h.selectMiniLoginRole(c, roles, request.Role)
	if !ok {
		return
	}

	if request.Scene != nil {
		scene := strings.TrimSpace(*request.Scene)
		if scene != "" {
			if selectedRole != "CUSTOMER" {
				h.writeError(c, http.StatusBadRequest, "invalid_request", "scene only allowed for customer login")
				return
			}
			if err := h.bindOwnerSalesUser(c, &user, scene); err != nil {
				return
			}
		}
	}

	userType, ok := userTypeFromRole(selectedRole)
	if !ok {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid role")
		return
	}

	var ownerSalesUserID *uuid.UUID
	if selectedRole == "CUSTOMER" && user.OwnerSalesUserID.Valid {
		owner := uuid.UUID(user.OwnerSalesUserID.Bytes)
		ownerSalesUserID = &owner
	}

	token, expiresAt, err := h.Auth.Issue(user.ID, selectedRole, roles, string(userType), ownerSalesUserID)
	if err != nil {
		h.logError("issue token failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
		return
	}

	response := oapi.AuthResponse{
		AccessToken: token,
		ExpiresIn:   expiresInSeconds(expiresAt),
		User:        userFromModel(user, roles, userType),
	}
	c.JSON(http.StatusOK, response)
}

func (h *Handler) PostAuthPasswordLogin(c *gin.Context) {
	if h.Store == nil || h.Auth == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "service not ready")
		return
	}

	var request oapi.PasswordLoginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if strings.TrimSpace(request.Username) == "" || strings.TrimSpace(request.Password) == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "username and password are required")
		return
	}

	if request.Role != nil && strings.ToUpper(string(*request.Role)) != "ADMIN" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "role not allowed")
		return
	}

	authRow, err := h.Store.GetUserPasswordByUsername(c.Request.Context(), request.Username)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusUnauthorized, "unauthorized", "invalid credentials")
			return
		}
		h.logError("lookup password failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(authRow.PasswordHash), []byte(request.Password)); err != nil {
		h.writeError(c, http.StatusUnauthorized, "unauthorized", "invalid credentials")
		return
	}

	user, err := h.Store.GetUserByID(c.Request.Context(), authRow.UserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusUnauthorized, "unauthorized", "invalid credentials")
			return
		}
		h.logError("lookup user failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
		return
	}
	if user.Status == "disabled" {
		h.writeError(c, http.StatusForbidden, "forbidden", "account disabled")
		return
	}

	roles, err := h.Store.ListUserRoles(c.Request.Context(), user.ID)
	if err != nil {
		h.logError("list roles failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
		return
	}
	roles = normalizeRoles(roles)
	if !containsRole(roles, "ADMIN") {
		h.writeError(c, http.StatusUnauthorized, "unauthorized", "invalid credentials")
		return
	}

	userType := oapi.UserUserTypeAdmin
	token, expiresAt, err := h.Auth.Issue(user.ID, "ADMIN", roles, string(userType), nil)
	if err != nil {
		h.logError("issue token failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
		return
	}

	response := oapi.AuthResponse{
		AccessToken: token,
		ExpiresIn:   expiresInSeconds(expiresAt),
		User:        userFromModel(user, roles, userType),
	}
	c.JSON(http.StatusOK, response)
}

func (h *Handler) selectMiniLoginRole(c *gin.Context, roles []string, requested *oapi.MiniLoginRequestRole) (string, bool) {
	requestedRole := ""
	if requested != nil {
		requestedRole = strings.ToUpper(string(*requested))
	}

	if requestedRole != "" {
		if _, ok := miniLoginRoles[requestedRole]; !ok {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "role not allowed")
			return "", false
		}
		if !containsRole(roles, requestedRole) {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "role not assigned")
			return "", false
		}
		return requestedRole, true
	}

	if len(roles) > 1 {
		available := filterMiniLoginRoles(roles)
		if len(available) == 0 {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "role not allowed")
			return "", false
		}
		h.writeErrorWithDetails(c, http.StatusConflict, "conflict", "role selection required", map[string]interface{}{
			"availableRoles": available,
		})
		return "", false
	}

	available := filterMiniLoginRoles(roles)
	if len(available) == 1 {
		return available[0], true
	}

	h.writeError(c, http.StatusBadRequest, "invalid_request", "role not allowed")
	return "", false
}

func (h *Handler) bindOwnerSalesUser(c *gin.Context, user *db.User, scene string) error {
	qr, err := h.Store.GetSalesQrCode(c.Request.Context(), scene)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid scene")
			return err
		}
		h.logError("lookup sales qr failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
		return err
	}
	if qr.ExpiresAt.Valid && qr.ExpiresAt.Time.Before(time.Now()) {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "scene expired")
		return errors.New("scene expired")
	}

	if user.OwnerSalesUserID.Valid {
		return nil
	}

	updated, err := h.Store.BindOwnerSalesUser(c.Request.Context(), db.BindOwnerSalesUserParams{
		ID: user.ID,
		OwnerSalesUserID: pgtype.UUID{
			Bytes: qr.SalesUserID,
			Valid: true,
		},
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		h.logError("bind sales failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
		return err
	}
	*user = updated
	return nil
}

func (h *Handler) bindStaffIdentity(c *gin.Context, platformName, providerUserID, unionID, bindingToken string) (db.User, []string, error) {
	token, err := h.Store.GetStaffBindingToken(c.Request.Context(), bindingToken)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusUnauthorized, "unauthorized", "invalid binding token")
			return db.User{}, nil, err
		}
		h.logError("lookup binding token failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
		return db.User{}, nil, err
	}
	if token.UsedAt.Valid {
		h.writeError(c, http.StatusUnauthorized, "unauthorized", "binding token already used")
		return db.User{}, nil, errors.New("binding token used")
	}
	if token.ExpiresAt.Valid && token.ExpiresAt.Time.Before(time.Now()) {
		h.writeError(c, http.StatusUnauthorized, "unauthorized", "binding token expired")
		return db.User{}, nil, errors.New("binding token expired")
	}
	if token.Platform != platformName {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "binding token platform mismatch")
		return db.User{}, nil, errors.New("binding token platform mismatch")
	}

	user, err := h.Store.GetUserByID(c.Request.Context(), token.StaffUserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "staff not found")
			return db.User{}, nil, err
		}
		h.logError("lookup staff failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
		return db.User{}, nil, err
	}
	if user.Status == "disabled" {
		h.writeError(c, http.StatusForbidden, "forbidden", "account disabled")
		return db.User{}, nil, errors.New("staff disabled")
	}
	if strings.ToLower(user.UserType) != "staff" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "binding token not for staff")
		return db.User{}, nil, errors.New("binding token not for staff")
	}

	roles, err := h.Store.ListUserRoles(c.Request.Context(), user.ID)
	if err != nil {
		h.logError("list roles failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
		return db.User{}, nil, err
	}
	roles = normalizeRoles(roles)
	if len(roles) == 0 {
		h.writeError(c, http.StatusUnauthorized, "unauthorized", "no roles assigned")
		return db.User{}, nil, errors.New("no roles assigned")
	}

	var unionPtr *string
	if strings.TrimSpace(unionID) != "" {
		unionPtr = &unionID
	}

	err = shareddb.WithTx(c.Request.Context(), h.DB, func(tx pgx.Tx) error {
		q := h.Store.WithTx(tx)
		if _, err := q.CreateUserIdentity(c.Request.Context(), db.CreateUserIdentityParams{
			ID:              uuid.New(),
			Provider:        platformName,
			ProviderUserID:  providerUserID,
			ProviderUnionID: unionPtr,
			UserID:          user.ID,
		}); err != nil {
			return err
		}
		if err := q.MarkStaffBindingTokenUsed(c.Request.Context(), bindingToken); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		if shareddb.IsUniqueViolation(err) {
			h.writeError(c, http.StatusConflict, "conflict", "identity already bound")
			return db.User{}, nil, err
		}
		h.logError("bind staff identity failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
		return db.User{}, nil, err
	}

	h.recordAudit(c, &user.ID, "staff.bind", "staff", &user.ID, map[string]interface{}{
		"platform": platformName,
	})

	return user, roles, nil
}
