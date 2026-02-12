package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	openapi_types "github.com/oapi-codegen/runtime/types"

	shareddb "github.com/teamdsb/tmo/packages/go-shared/db"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

func (h *Handler) GetAddresses(c *gin.Context) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	addresses, err := h.AddressStore.ListUserAddresses(c.Request.Context(), claims.UserID)
	if err != nil {
		h.logError("list addresses failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list addresses")
		return
	}

	items := make([]oapi.UserAddress, 0, len(addresses))
	for _, address := range addresses {
		items = append(items, userAddressFromModel(address))
	}

	c.JSON(http.StatusOK, oapi.ListAddressesResponse{
		Items: items,
	})
}

func (h *Handler) PostAddresses(c *gin.Context) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	var request oapi.CreateUserAddressRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	receiverName := strings.TrimSpace(request.ReceiverName)
	receiverPhone := strings.TrimSpace(request.ReceiverPhone)
	detail := strings.TrimSpace(request.Detail)
	if receiverName == "" || receiverPhone == "" || detail == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "receiverName, receiverPhone and detail are required")
		return
	}

	var created db.UserAddress
	err := h.withTx(c, func(q *db.Queries) error {
		count, err := q.CountUserAddresses(c.Request.Context(), claims.UserID)
		if err != nil {
			return err
		}

		shouldSetDefault := count == 0 || (request.IsDefault != nil && *request.IsDefault)
		if shouldSetDefault {
			if err := q.ClearUserDefaultAddresses(c.Request.Context(), claims.UserID); err != nil {
				return err
			}
		}

		created, err = q.CreateUserAddress(c.Request.Context(), db.CreateUserAddressParams{
			UserID:        claims.UserID,
			ReceiverName:  receiverName,
			ReceiverPhone: receiverPhone,
			Detail:        detail,
			IsDefault:     shouldSetDefault,
		})
		return err
	})
	if err != nil {
		h.logError("create address failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create address")
		return
	}

	c.JSON(http.StatusCreated, userAddressFromModel(created))
}

func (h *Handler) PatchAddressesAddressId(c *gin.Context, addressId openapi_types.UUID) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	var request oapi.UpdateUserAddressRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	noFieldProvided := request.ReceiverName == nil
	noFieldProvided = noFieldProvided && request.ReceiverPhone == nil
	noFieldProvided = noFieldProvided && request.Detail == nil
	noFieldProvided = noFieldProvided && request.IsDefault == nil
	if noFieldProvided {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "at least one field must be provided")
		return
	}

	var receiverName *string
	if request.ReceiverName != nil {
		trimmed := strings.TrimSpace(*request.ReceiverName)
		if trimmed == "" {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "receiverName cannot be empty")
			return
		}
		receiverName = &trimmed
	}

	var receiverPhone *string
	if request.ReceiverPhone != nil {
		trimmed := strings.TrimSpace(*request.ReceiverPhone)
		if trimmed == "" {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "receiverPhone cannot be empty")
			return
		}
		receiverPhone = &trimmed
	}

	var detail *string
	if request.Detail != nil {
		trimmed := strings.TrimSpace(*request.Detail)
		if trimmed == "" {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "detail cannot be empty")
			return
		}
		detail = &trimmed
	}

	var updated db.UserAddress
	err := h.withTx(c, func(q *db.Queries) error {
		current, err := q.GetUserAddress(c.Request.Context(), db.GetUserAddressParams{
			ID:     uuid.UUID(addressId),
			UserID: claims.UserID,
		})
		if err != nil {
			return err
		}

		var isDefault *bool
		if request.IsDefault != nil && *request.IsDefault {
			if err := q.ClearUserDefaultAddresses(c.Request.Context(), claims.UserID); err != nil {
				return err
			}
			trueValue := true
			isDefault = &trueValue
		} else if request.IsDefault != nil && !*request.IsDefault && !current.IsDefault {
			falseValue := false
			isDefault = &falseValue
		}

		updated, err = q.UpdateUserAddress(c.Request.Context(), db.UpdateUserAddressParams{
			ID:            uuid.UUID(addressId),
			UserID:        claims.UserID,
			ReceiverName:  receiverName,
			ReceiverPhone: receiverPhone,
			Detail:        detail,
			IsDefault:     isDefault,
		})
		return err
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "address not found")
			return
		}
		h.logError("update address failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update address")
		return
	}

	c.JSON(http.StatusOK, userAddressFromModel(updated))
}

func (h *Handler) DeleteAddressesAddressId(c *gin.Context, addressId openapi_types.UUID) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	err := h.withTx(c, func(q *db.Queries) error {
		deleted, err := q.DeleteUserAddress(c.Request.Context(), db.DeleteUserAddressParams{
			ID:     uuid.UUID(addressId),
			UserID: claims.UserID,
		})
		if err != nil {
			return err
		}

		if !deleted.IsDefault {
			return nil
		}

		nextDefault, err := q.GetLatestUserAddress(c.Request.Context(), claims.UserID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil
			}
			return err
		}

		_, err = q.SetUserAddressDefault(c.Request.Context(), db.SetUserAddressDefaultParams{
			ID:        nextDefault.ID,
			UserID:    claims.UserID,
			IsDefault: true,
		})
		return err
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "address not found")
			return
		}
		h.logError("delete address failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to delete address")
		return
	}

	c.Status(http.StatusNoContent)
}

func userAddressFromModel(model db.UserAddress) oapi.UserAddress {
	response := oapi.UserAddress{
		Id:            model.ID,
		ReceiverName:  model.ReceiverName,
		ReceiverPhone: model.ReceiverPhone,
		Detail:        model.Detail,
		IsDefault:     model.IsDefault,
		CreatedAt:     model.CreatedAt.Time,
		UpdatedAt:     model.UpdatedAt.Time,
	}
	return response
}

func (h *Handler) withTx(c *gin.Context, run func(q *db.Queries) error) error {
	if h.DB == nil {
		return errors.New("db pool is nil")
	}
	return shareddb.WithTx(c.Request.Context(), h.DB, func(tx pgx.Tx) error {
		return run(db.New(tx))
	})
}
