package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	shareddb "github.com/teamdsb/tmo/packages/go-shared/db"
	"github.com/teamdsb/tmo/services/identity/internal/db"
	"github.com/teamdsb/tmo/services/identity/internal/http/oapi"
	"github.com/teamdsb/tmo/services/identity/internal/platform"
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
	proof := miniLoginPhoneProofFromRequest(request)
	hasPhoneProof := hasMiniLoginPhoneProof(proof)
	identity, err := h.Platform.Resolve(c.Request.Context(), platformName, request.Code)
	if err != nil {
		if h.Platform.RequiresPhoneProof() && !hasPhoneProof && !h.Platform.SupportsPhoneProofSimulation() {
			h.writeError(c, http.StatusBadRequest, "phone_required", "phone proof is required")
			return
		}
		h.logError("resolve mini login failed", err)
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid login code")
		return
	}

	user, err := h.Store.GetUserByIdentity(c.Request.Context(), db.GetUserByIdentityParams{
		Provider:       platformName,
		ProviderUserID: identity.ProviderUserID,
	})
	var existingUser *db.User
	if err == nil {
		existingUser = &user
	}

	phone, ok := h.resolveMiniLoginPhone(c, platformName, proof, existingUser)
	if !ok {
		return
	}

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
			if err := h.bindMiniLoginPhone(c, &user, phone); err != nil {
				return
			}
		} else {
			requestedRole := ""
			if request.Role != nil {
				requestedRole = strings.ToUpper(string(*request.Role))
			}
			if requestedRole != "" && requestedRole != "CUSTOMER" {
				h.writeError(c, http.StatusBadRequest, "invalid_request", "role not allowed")
				return
			}

			linkedUser, linkedRoles, linkErr := h.findOrCreateMiniLoginCustomer(c, platformName, identity, phone)
			if linkErr != nil {
				return
			}
			user = linkedUser
			roles = linkedRoles
		}
	} else {
		if request.BindingToken != nil && strings.TrimSpace(*request.BindingToken) != "" {
			h.writeError(c, http.StatusConflict, "conflict", "identity already bound")
			return
		}
		if err := h.bindMiniLoginPhone(c, &user, phone); err != nil {
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

func (h *Handler) resolveMiniLoginPhone(
	c *gin.Context,
	platformName string,
	proof platform.PhoneProof,
	existingUser *db.User,
) (string, bool) {
	hasProof := hasMiniLoginPhoneProof(proof)
	if !hasProof {
		if existingUser != nil && existingUser.Phone != nil && strings.TrimSpace(*existingUser.Phone) != "" {
			normalized, err := normalizePhone(*existingUser.Phone)
			if err == nil {
				return normalized, true
			}
		}
		if !h.Platform.RequiresPhoneProof() {
			return "", true
		}
		if !h.Platform.SupportsPhoneProofSimulation() {
			h.writeError(c, http.StatusBadRequest, "phone_required", "phone proof is required")
			return "", false
		}
	}

	phone, err := h.Platform.ResolvePhone(c.Request.Context(), platformName, proof)
	if err != nil {
		if existingUser != nil && existingUser.Phone != nil && strings.TrimSpace(*existingUser.Phone) != "" {
			normalizedExistingPhone, normalizeErr := normalizePhone(*existingUser.Phone)
			if normalizeErr == nil {
				return normalizedExistingPhone, true
			}
		}
		h.logError("resolve phone proof failed", err)
		if h.Platform.RequiresPhoneProof() {
			h.writeError(c, http.StatusBadRequest, "invalid_phone_proof", "failed to verify phone proof")
			return "", false
		}
		return "", true
	}

	normalized, err := normalizePhone(phone)
	if err != nil {
		if h.Platform.RequiresPhoneProof() {
			h.writeError(c, http.StatusBadRequest, "invalid_phone", "invalid phone number")
			return "", false
		}
		return "", true
	}
	return normalized, true
}

func hasMiniLoginPhoneProof(proof platform.PhoneProof) bool {
	return strings.TrimSpace(proof.Phone) != "" ||
		strings.TrimSpace(proof.Code) != "" ||
		strings.TrimSpace(proof.Response) != ""
}

func miniLoginPhoneProofFromRequest(request oapi.MiniLoginRequest) platform.PhoneProof {
	var proof platform.PhoneProof
	if request.PhoneProof == nil {
		return proof
	}
	if request.PhoneProof.Code != nil {
		proof.Code = strings.TrimSpace(*request.PhoneProof.Code)
	}
	if request.PhoneProof.Phone != nil {
		proof.Phone = strings.TrimSpace(*request.PhoneProof.Phone)
	}
	if request.PhoneProof.Response != nil {
		proof.Response = strings.TrimSpace(*request.PhoneProof.Response)
	}
	if request.PhoneProof.Sign != nil {
		proof.Sign = strings.TrimSpace(*request.PhoneProof.Sign)
	}
	if request.PhoneProof.SignType != nil {
		proof.SignType = strings.TrimSpace(*request.PhoneProof.SignType)
	}
	if request.PhoneProof.EncryptType != nil {
		proof.EncryptType = strings.TrimSpace(*request.PhoneProof.EncryptType)
	}
	if request.PhoneProof.Charset != nil {
		proof.Charset = strings.TrimSpace(*request.PhoneProof.Charset)
	}
	return proof
}

func (h *Handler) findOrCreateMiniLoginCustomer(
	c *gin.Context,
	platformName string,
	identity platform.LoginIdentity,
	phone string,
) (db.User, []string, error) {
	if strings.TrimSpace(phone) != "" {
		phoneParam := phone
		existing, err := h.Store.GetUserByPhone(c.Request.Context(), &phoneParam)
		if err == nil {
			if strings.ToLower(existing.UserType) != "customer" {
				h.writeError(c, http.StatusConflict, "conflict", "phone already linked to a non-customer account")
				return db.User{}, nil, errors.New("phone linked to non-customer")
			}

			roles, err := h.Store.ListUserRoles(c.Request.Context(), existing.ID)
			if err != nil {
				h.logError("list roles by phone failed", err)
				h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
				return db.User{}, nil, err
			}
			roles = normalizeRoles(roles)

			var unionID *string
			if strings.TrimSpace(identity.UnionID) != "" {
				unionID = &identity.UnionID
			}

			err = shareddb.WithTx(c.Request.Context(), h.DB, func(tx pgx.Tx) error {
				q := h.Store.WithTx(tx)
				if !containsRole(roles, "CUSTOMER") {
					if err := q.AddUserRole(c.Request.Context(), db.AddUserRoleParams{
						UserID: existing.ID,
						Role:   "CUSTOMER",
					}); err != nil {
						return err
					}
				}
				if _, err := q.CreateUserIdentity(c.Request.Context(), db.CreateUserIdentityParams{
					ID:              uuid.New(),
					Provider:        platformName,
					ProviderUserID:  identity.ProviderUserID,
					ProviderUnionID: unionID,
					UserID:          existing.ID,
				}); err != nil {
					return err
				}
				return nil
			})
			if err != nil {
				if shareddb.IsUniqueViolation(err) {
					h.writeError(c, http.StatusConflict, "conflict", "identity already bound")
					return db.User{}, nil, err
				}
				h.logError("bind identity by phone failed", err)
				h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
				return db.User{}, nil, err
			}

			if !containsRole(roles, "CUSTOMER") {
				roles = append(roles, "CUSTOMER")
			}
			return existing, normalizeRoles(roles), nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			h.logError("lookup user by phone failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
			return db.User{}, nil, err
		}
	}

	var createdUser db.User
	var unionID *string
	if strings.TrimSpace(identity.UnionID) != "" {
		unionID = &identity.UnionID
	}
	displayName := defaultDisplayNameFromPhone(phone)
	var phonePtr *string
	if strings.TrimSpace(phone) != "" {
		phonePtr = &phone
	}
	err := shareddb.WithTx(c.Request.Context(), h.DB, func(tx pgx.Tx) error {
		q := h.Store.WithTx(tx)
		newUser, err := q.CreateUser(c.Request.Context(), db.CreateUserParams{
			ID:               uuid.New(),
			DisplayName:      displayName,
			Phone:            phonePtr,
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
			return db.User{}, nil, err
		}
		h.logError("create user failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
		return db.User{}, nil, err
	}
	return createdUser, []string{"CUSTOMER"}, nil
}

func (h *Handler) bindMiniLoginPhone(c *gin.Context, user *db.User, phone string) error {
	trimmedPhone := strings.TrimSpace(phone)
	if trimmedPhone == "" {
		return nil
	}

	if user.Phone != nil && strings.TrimSpace(*user.Phone) != "" {
		existing, err := normalizePhone(*user.Phone)
		if err != nil {
			h.logError("normalize existing phone failed", err)
			h.writeError(c, http.StatusConflict, "conflict", "phone already linked to another account")
			return err
		}
		if existing != trimmedPhone {
			h.writeError(c, http.StatusConflict, "conflict", "phone already linked to another account")
			return errors.New("phone mismatch")
		}
		return nil
	}

	updated, err := h.Store.BindUserPhone(c.Request.Context(), db.BindUserPhoneParams{
		ID:    user.ID,
		Phone: &trimmedPhone,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusConflict, "conflict", "phone already linked to another account")
			return err
		}
		if shareddb.IsUniqueViolation(err) {
			h.writeError(c, http.StatusConflict, "conflict", "phone already linked to another account")
			return err
		}
		h.logError("bind user phone failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "login failed")
		return err
	}
	*user = updated
	return nil
}

func normalizePhone(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", errors.New("phone is empty")
	}

	var digitsBuilder strings.Builder
	hasPlus := strings.HasPrefix(trimmed, "+")
	for _, char := range trimmed {
		if unicode.IsDigit(char) {
			digitsBuilder.WriteRune(char)
		}
	}
	digits := digitsBuilder.String()
	if digits == "" {
		return "", errors.New("phone has no digits")
	}

	if hasPlus {
		return "+" + digits, nil
	}
	if strings.HasPrefix(digits, "00") && len(digits) > 2 {
		return "+" + digits[2:], nil
	}
	if strings.HasPrefix(digits, "86") && len(digits) == 13 {
		return "+" + digits, nil
	}
	if len(digits) == 11 && strings.HasPrefix(digits, "1") {
		return "+86" + digits, nil
	}
	if len(digits) >= 7 {
		return "+" + digits, nil
	}
	return "", errors.New("phone length is invalid")
}

func defaultDisplayNameFromPhone(phone string) *string {
	digits := make([]rune, 0, len(phone))
	for _, char := range phone {
		if unicode.IsDigit(char) {
			digits = append(digits, char)
		}
	}
	if len(digits) == 0 {
		return nil
	}

	start := len(digits) - 4
	if start < 0 {
		start = 0
	}
	value := "用户" + string(digits[start:])
	return &value
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
