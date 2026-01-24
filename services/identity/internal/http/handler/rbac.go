package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	shareddb "github.com/teamdsb/tmo/packages/go-shared/db"
	"github.com/teamdsb/tmo/services/identity/internal/db"
	"github.com/teamdsb/tmo/services/identity/internal/http/oapi"
)

func (h *Handler) GetMePermissions(c *gin.Context) {
	claims, ok := h.requireClaims(c)
	if !ok {
		return
	}

	permissions, err := h.Store.ListEffectivePermissions(c.Request.Context(), claims.UserID)
	if err != nil {
		h.logError("list effective permissions failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch permissions")
		return
	}

	items := make([]oapi.EffectivePermission, 0, len(permissions))
	for _, perm := range permissions {
		items = append(items, oapi.EffectivePermission{
			Code:  perm.PermissionCode,
			Scope: oapi.PermissionScope(perm.Scope),
		})
	}

	c.JSON(http.StatusOK, oapi.PermissionList{Items: items})
}

func (h *Handler) GetRbacRoles(c *gin.Context) {
	if _, ok := h.requireAdmin(c); !ok {
		return
	}

	roles, err := h.Store.ListRoles(c.Request.Context())
	if err != nil {
		h.logError("list roles failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list roles")
		return
	}

	response := make([]oapi.Role, 0, len(roles))
	for _, role := range roles {
		permissions, err := h.Store.ListRolePermissions(c.Request.Context(), role.Code)
		if err != nil {
			h.logError("list role permissions failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list roles")
			return
		}
		rolePerms := make([]oapi.RolePermission, 0, len(permissions))
		for _, permission := range permissions {
			rolePerms = append(rolePerms, oapi.RolePermission{
				Code:  permission.PermissionCode,
				Scope: oapi.PermissionScope(permission.Scope),
			})
		}
		response = append(response, oapi.Role{
			Code:        role.Code,
			UserType:    oapi.RoleUserType(role.UserType),
			Description: role.Description,
			Permissions: rolePerms,
		})
	}

	c.JSON(http.StatusOK, oapi.RoleList{Items: response})
}

func (h *Handler) GetRbacPermissions(c *gin.Context) {
	if _, ok := h.requireAdmin(c); !ok {
		return
	}

	permissions, err := h.Store.ListPermissions(c.Request.Context())
	if err != nil {
		h.logError("list permissions failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list permissions")
		return
	}

	response := make([]oapi.Permission, 0, len(permissions))
	for _, permission := range permissions {
		response = append(response, oapi.Permission{
			Code:        permission.Code,
			Description: permission.Description,
		})
	}
	c.JSON(http.StatusOK, oapi.PermissionCatalog{Items: response})
}

func (h *Handler) PostRbacPermissions(c *gin.Context) {
	claims, ok := h.requireAdmin(c)
	if !ok {
		return
	}

	var request oapi.PermissionCreateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	code := strings.TrimSpace(request.Code)
	if code == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "code is required")
		return
	}

	permission, err := h.Store.UpsertPermission(c.Request.Context(), db.UpsertPermissionParams{
		Code:        code,
		Description: request.Description,
	})
	if err != nil {
		h.logError("create permission failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create permission")
		return
	}

	h.recordAudit(c, &claims.UserID, "rbac.permission.upsert", "permission", nil, map[string]interface{}{
		"code": code,
	})

	c.JSON(http.StatusCreated, oapi.Permission{
		Code:        permission.Code,
		Description: permission.Description,
	})
}

func (h *Handler) PutRbacRolesRolePermissions(c *gin.Context, role string) {
	claims, ok := h.requireAdmin(c)
	if !ok {
		return
	}

	_, err := h.Store.GetRole(c.Request.Context(), role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "role not found")
			return
		}
		h.logError("get role failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update role")
		return
	}

	var request oapi.RolePermissionsUpdate
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	permissions, err := h.Store.ListPermissions(c.Request.Context())
	if err != nil {
		h.logError("list permissions failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update role")
		return
	}
	known := make(map[string]struct{}, len(permissions))
	for _, permission := range permissions {
		known[permission.Code] = struct{}{}
	}
	for _, item := range request.Permissions {
		if _, ok := known[item.Code]; !ok {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "unknown permission: "+item.Code)
			return
		}
		if scopeRank(string(item.Scope)) == 0 {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid scope: "+string(item.Scope))
			return
		}
	}

	err = shareddb.WithTx(c.Request.Context(), h.DB, func(tx pgx.Tx) error {
		q := h.Store.WithTx(tx)
		if err := q.DeleteRolePermissions(c.Request.Context(), role); err != nil {
			return err
		}
		for _, item := range request.Permissions {
			if err := q.AddRolePermission(c.Request.Context(), db.AddRolePermissionParams{
				RoleCode:       role,
				PermissionCode: item.Code,
				Scope:          string(item.Scope),
			}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		h.logError("update role permissions failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update role")
		return
	}

	h.recordAudit(c, &claims.UserID, "rbac.role.update_permissions", "role", nil, map[string]interface{}{
		"role": role,
	})

	c.Status(http.StatusNoContent)
}

func (h *Handler) PostRbacAuthorize(c *gin.Context) {
	claims, ok := h.requireClaims(c)
	if !ok {
		return
	}

	var request oapi.AuthorizeRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	permissionCode := strings.TrimSpace(request.Permission)
	if permissionCode == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "permission is required")
		return
	}

	permissions, err := h.Store.ListEffectivePermissions(c.Request.Context(), claims.UserID)
	if err != nil {
		h.logError("list effective permissions failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to authorize")
		return
	}

	effectiveScope := ""
	for _, permission := range permissions {
		if permission.PermissionCode == permissionCode {
			effectiveScope = permission.Scope
			break
		}
	}
	requiredScope := ""
	if request.RequiredScope != nil {
		requiredScope = string(*request.RequiredScope)
	}

	allowed := false
	if effectiveScope != "" {
		if requiredScope == "" {
			allowed = true
		} else {
			allowed = scopeAllows(effectiveScope, requiredScope)
		}
	}

	response := oapi.AuthorizeResponse{
		Allowed: allowed,
	}
	if effectiveScope != "" {
		scope := oapi.PermissionScope(effectiveScope)
		response.EffectiveScope = &scope
	}
	c.JSON(http.StatusOK, response)
}
