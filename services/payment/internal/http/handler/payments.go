package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/oapi-codegen/runtime/types"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
	"github.com/teamdsb/tmo/services/payment/internal/db"
	"github.com/teamdsb/tmo/services/payment/internal/http/middleware"
	"github.com/teamdsb/tmo/services/payment/internal/http/oapi"
)

const (
	paymentStatusPending   = "PAY_PENDING"
	paymentStatusPaid      = "PAID"
	paymentStatusFailed    = "PAY_FAILED"
	paymentStatusCancelled = "CANCELLED"

	paymentChannelWechat = "WECHAT"
	paymentChannelAlipay = "ALIPAY"
)

type normalizedNotifyPayload struct {
	PaymentID       string
	Status          string
	ProviderTradeNo *string
	EventType       string
}

func (h *Handler) PostPaymentsWechatCreate(c *gin.Context, params oapi.PostPaymentsWechatCreateParams) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	var request oapi.PostPaymentsWechatCreateJSONBody
	if err := c.ShouldBindJSON(&request); err != nil {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "invalid_request",
			Message: "invalid request body",
		})
		return
	}

	response, err := h.createPaymentSession(c, claims, uuid.UUID(request.OrderId), paymentChannelWechat, params.IdempotencyKey)
	if err != nil {
		h.writePaymentError(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) PostPaymentsAlipayCreate(c *gin.Context, params oapi.PostPaymentsAlipayCreateParams) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	var request oapi.PostPaymentsAlipayCreateJSONBody
	if err := c.ShouldBindJSON(&request); err != nil {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "invalid_request",
			Message: "invalid request body",
		})
		return
	}

	response, err := h.createPaymentSession(c, claims, uuid.UUID(request.OrderId), paymentChannelAlipay, params.IdempotencyKey)
	if err != nil {
		h.writePaymentError(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) GetPaymentsPaymentId(c *gin.Context, paymentId types.UUID) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	payment, err := h.loadPayment(c, uuid.UUID(paymentId))
	if err != nil {
		h.writePaymentError(c, err)
		return
	}
	if !canAccessPayment(claims, payment) {
		apierrors.Write(c, http.StatusNotFound, apierrors.APIError{
			Code:    "not_found",
			Message: "payment not found",
		})
		return
	}

	c.JSON(http.StatusOK, paymentDetailFromModel(payment))
}

func (h *Handler) PostPaymentsPaymentIdRecheck(c *gin.Context, paymentId types.UUID) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	var request oapi.PaymentRecheckRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&request); err != nil {
			apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
				Code:    "invalid_request",
				Message: "invalid request body",
			})
			return
		}
	}

	payment, err := h.loadPayment(c, uuid.UUID(paymentId))
	if err != nil {
		h.writePaymentError(c, err)
		return
	}
	if !canAccessPayment(claims, payment) {
		apierrors.Write(c, http.StatusNotFound, apierrors.APIError{
			Code:    "not_found",
			Message: "payment not found",
		})
		return
	}

	updated, err := h.resolvePaymentFromClientResult(c, payment, request)
	if err != nil {
		h.writePaymentError(c, err)
		return
	}

	c.JSON(http.StatusOK, paymentDetailFromModel(updated))
}

func (h *Handler) PostPaymentsWechatNotify(c *gin.Context) {
	h.handleNotify(c, paymentChannelWechat)
}

func (h *Handler) PostPaymentsAlipayNotify(c *gin.Context) {
	h.handleNotify(c, paymentChannelAlipay)
}

func (h *Handler) handleNotify(c *gin.Context, channel string) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "invalid_request",
			Message: "invalid request body",
		})
		return
	}

	flags := h.getFeatureFlags(c)
	if !flags.PaymentEnabled {
		c.Status(http.StatusOK)
		return
	}

	normalized, err := normalizeNotifyPayload(payload)
	if err != nil {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "invalid_request",
			Message: err.Error(),
		})
		return
	}

	paymentID, err := uuid.Parse(normalized.PaymentID)
	if err != nil {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "invalid_request",
			Message: "invalid paymentId",
		})
		return
	}

	payment, err := h.loadPayment(c, paymentID)
	if err != nil {
		h.writePaymentError(c, err)
		return
	}

	rawBody, _ := json.Marshal(payload)
	if _, err := h.Store.CreatePaymentWebhook(c.Request.Context(), db.CreatePaymentWebhookParams{
		PaymentID:      toNullableUUID(payment.ID),
		Provider:       strings.ToLower(channel),
		EventType:      normalizeWebhookEventType(normalized.EventType, normalized.Status),
		DeliveryStatus: strings.ToUpper(normalized.Status),
		RawBody:        rawBody,
		ProcessedAt:    pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	}); err != nil {
		h.logError("create payment webhook failed", err)
	}

	updated, err := h.applyPaymentResolution(c, payment, normalized.Status, normalized.ProviderTradeNo, nil)
	if err != nil {
		h.writePaymentError(c, err)
		return
	}

	if err := h.recordAudit(c.Request.Context(), updated.ID, "webhook_processed", "system", fmt.Sprintf("%s webhook -> %s", channel, updated.Status)); err != nil {
		h.logError("create payment audit log failed", err)
	}

	c.JSON(http.StatusOK, paymentDetailFromModel(updated))
}

func (h *Handler) createPaymentSession(c *gin.Context, claims middleware.Claims, orderID uuid.UUID, channel string, idempotencyKey *string) (interface{}, error) {
	if h.Store == nil {
		return nil, errInternal("payment store is not configured")
	}

	flags := h.getFeatureFlags(c)
	if !flags.PaymentEnabled {
		return nil, errForbidden("payment is disabled")
	}
	if channel == paymentChannelWechat && !flags.WechatPayEnabled {
		return nil, errForbidden("wechat pay is disabled")
	}
	if channel == paymentChannelAlipay && !flags.AlipayPayEnabled {
		return nil, errForbidden("alipay is disabled")
	}

	order, err := h.Commerce.GetOrder(c.Request.Context(), c.GetHeader("Authorization"), orderID.String())
	if err != nil {
		return nil, errInternal(fmt.Sprintf("fetch order failed: %v", err))
	}
	if !isOrderPayable(order.Status, order.PaymentStatus) {
		return nil, errConflict("order is not payable")
	}

	if idempotencyKey != nil && strings.TrimSpace(*idempotencyKey) != "" {
		trimmedKey := strings.TrimSpace(*idempotencyKey)
		existing, err := h.Store.GetPaymentByIdempotencyKey(c.Request.Context(), db.GetPaymentByIdempotencyKeyParams{
			OrderID:        orderID,
			Channel:        channel,
			IdempotencyKey: &trimmedKey,
		})
		if err == nil {
			return createResponseFromPayment(existing)
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, errInternal("check payment idempotency failed")
		}
	}

	now := time.Now().UTC()
	expiresAt := now.Add(15 * time.Minute)
	amount := calculateOrderAmount(order)
	responsePayload, providerTradeNo, providerPrepayID, rawPayload, err := buildProviderPayload(channel, orderID, now, expiresAt)
	if err != nil {
		return nil, errInternal("build payment payload failed")
	}

	params := db.CreatePaymentParams{
		OrderID:          orderID,
		PayerUserID:      toNullableUUID(claims.UserID),
		Channel:          channel,
		Status:           paymentStatusPending,
		AmountFen:        amount,
		Currency:         "CNY",
		IdempotencyKey:   normalizeOptionalString(idempotencyKey),
		ProviderTradeNo:  providerTradeNo,
		ProviderPrepayID: providerPrepayID,
		ProviderPayload:  rawPayload,
		FailureCode:      nil,
		FailureMessage:   nil,
		PaidAt:           pgtype.Timestamptz{},
		ClosedAt:         pgtype.Timestamptz{},
	}

	payment, err := h.Store.CreatePayment(c.Request.Context(), params)
	if err != nil {
		return nil, errInternal("create payment failed")
	}

	if err := h.recordAudit(c.Request.Context(), payment.ID, "created", "user", "payment session created"); err != nil {
		h.logError("create payment audit log failed", err)
	}

	if h.Commerce != nil {
		if err := h.Commerce.SyncOrderPayment(c.Request.Context(), orderID.String(), CommercePaymentSyncRequest{
			PaymentID: payment.ID.String(),
			Channel:   channel,
			Status:    paymentStatusPending,
		}); err != nil {
			return nil, errInternal(fmt.Sprintf("sync order payment failed: %v", err))
		}
	}

	return hydrateCreateResponseIDs(payment.ID, responsePayload), nil
}

func (h *Handler) resolvePaymentFromClientResult(c *gin.Context, payment db.Payment, request oapi.PaymentRecheckRequest) (db.Payment, error) {
	clientResult := ""
	if request.ClientResult != nil {
		clientResult = string(*request.ClientResult)
	}
	reason := normalizeOptionalString(request.Reason)

	switch strings.ToUpper(strings.TrimSpace(h.ProviderMode)) {
	case "", "MOCK":
		switch strings.ToUpper(strings.TrimSpace(clientResult)) {
		case "SUCCESS":
			return h.applyPaymentResolution(c, payment, paymentStatusPaid, payment.ProviderTradeNo, nil)
		case "FAILED":
			return h.applyPaymentResolution(c, payment, paymentStatusFailed, payment.ProviderTradeNo, reason)
		case "CANCELLED":
			return h.applyPaymentResolution(c, payment, paymentStatusCancelled, payment.ProviderTradeNo, reason)
		default:
			return payment, nil
		}
	default:
		return payment, nil
	}
}

func (h *Handler) applyPaymentResolution(c *gin.Context, payment db.Payment, status string, providerTradeNo *string, reason *string) (db.Payment, error) {
	normalizedStatus := strings.ToUpper(strings.TrimSpace(status))
	if payment.Status == normalizedStatus {
		return payment, nil
	}

	paidAt := pgtype.Timestamptz{}
	closedAt := pgtype.Timestamptz{}
	var failureCode *string
	failureMessage := reason
	switch normalizedStatus {
	case paymentStatusPaid:
		paidAt = pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	case paymentStatusFailed, paymentStatusCancelled:
		closedAt = pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
		if normalizedStatus == paymentStatusCancelled {
			value := "CLIENT_CANCELLED"
			failureCode = &value
		}
		if normalizedStatus == paymentStatusFailed {
			value := "CLIENT_FAILED"
			failureCode = &value
		}
	default:
		return payment, errBadRequest("invalid payment status")
	}

	updated, err := h.Store.UpdatePaymentState(c.Request.Context(), db.UpdatePaymentStateParams{
		ID:               payment.ID,
		Status:           normalizedStatus,
		ProviderTradeNo:  providerTradeNo,
		ProviderPrepayID: normalizeOptionalString(payment.ProviderPrepayID),
		ProviderPayload:  payment.ProviderPayload,
		FailureCode:      failureCode,
		FailureMessage:   failureMessage,
		PaidAt:           paidAt,
		ClosedAt:         closedAt,
	})
	if err != nil {
		return db.Payment{}, errInternal("update payment failed")
	}

	if h.Commerce != nil {
		var paidAtTime *time.Time
		if updated.PaidAt.Valid {
			value := updated.PaidAt.Time
			paidAtTime = &value
		}
		if err := h.Commerce.SyncOrderPayment(c.Request.Context(), updated.OrderID.String(), CommercePaymentSyncRequest{
			PaymentID:       updated.ID.String(),
			Channel:         updated.Channel,
			Status:          updated.Status,
			ProviderTradeNo: providerTradeNo,
			PaidAt:          paidAtTime,
		}); err != nil {
			return db.Payment{}, errInternal(fmt.Sprintf("sync order payment failed: %v", err))
		}
	}

	actor := "system"
	if c != nil {
		if claims, ok := h.requireUser(c); ok && claims.UserID != uuid.Nil {
			actor = claims.UserID.String()
		}
	}
	if err := h.recordAudit(c.Request.Context(), updated.ID, "status_updated", actor, "payment status -> "+updated.Status); err != nil {
		h.logError("create payment audit log failed", err)
	}

	return updated, nil
}

func (h *Handler) loadPayment(c *gin.Context, paymentID uuid.UUID) (db.Payment, error) {
	if h.Store == nil {
		return db.Payment{}, errInternal("payment store is not configured")
	}
	payment, err := h.Store.GetPayment(c.Request.Context(), paymentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Payment{}, errNotFound("payment not found")
		}
		return db.Payment{}, errInternal("load payment failed")
	}
	return payment, nil
}

func paymentDetailFromModel(payment db.Payment) oapi.PaymentDetail {
	response := oapi.PaymentDetail{
		Id:        payment.ID,
		OrderId:   payment.OrderID,
		Channel:   oapi.PaymentChannel(payment.Channel),
		Status:    oapi.PaymentStatus(payment.Status),
		AmountFen: payment.AmountFen,
		Currency:  payment.Currency,
		CreatedAt: payment.CreatedAt.Time,
		UpdatedAt: payment.UpdatedAt.Time,
	}
	if payment.PayerUserID.Valid {
		payerID := types.UUID(payment.PayerUserID.Bytes)
		response.PayerUserId = &payerID
	}
	if payment.ProviderTradeNo != nil {
		response.ProviderTradeNo = payment.ProviderTradeNo
	}
	if payment.ProviderPrepayID != nil {
		response.ProviderPrepayId = payment.ProviderPrepayID
	}
	if payment.FailureCode != nil {
		response.FailureCode = payment.FailureCode
	}
	if payment.FailureMessage != nil {
		response.FailureMessage = payment.FailureMessage
	}
	if payment.PaidAt.Valid {
		value := payment.PaidAt.Time
		response.PaidAt = &value
	}
	return response
}

func createResponseFromPayment(payment db.Payment) (interface{}, error) {
	switch payment.Channel {
	case paymentChannelWechat:
		var response oapi.WechatPayCreateResponse
		if err := json.Unmarshal(payment.ProviderPayload, &response); err != nil {
			return nil, errInternal("decode wechat payment payload failed")
		}
		return response, nil
	case paymentChannelAlipay:
		var response oapi.AlipayPayCreateResponse
		if err := json.Unmarshal(payment.ProviderPayload, &response); err != nil {
			return nil, errInternal("decode alipay payment payload failed")
		}
		return response, nil
	default:
		return nil, errInternal("unsupported payment channel")
	}
}

func hydrateCreateResponseIDs(paymentID uuid.UUID, payload interface{}) interface{} {
	switch response := payload.(type) {
	case oapi.WechatPayCreateResponse:
		response.PaymentId = paymentID
		return response
	case oapi.AlipayPayCreateResponse:
		response.PaymentId = paymentID
		return response
	default:
		return payload
	}
}

func buildProviderPayload(channel string, orderID uuid.UUID, now time.Time, expiresAt time.Time) (interface{}, *string, *string, json.RawMessage, error) {
	switch channel {
	case paymentChannelWechat:
		prepayID := "prepay_" + uuid.NewString()
		pkg := "prepay_id=" + prepayID
		response := oapi.WechatPayCreateResponse{
			OrderId:   orderID,
			Channel:   oapi.PaymentChannel(paymentChannelWechat),
			Status:    oapi.PaymentStatus(paymentStatusPending),
			ExpiresAt: expiresAt,
			PrepayId:  prepayID,
			Package:   pkg,
			NonceStr:  uuid.NewString(),
			TimeStamp: strconv.FormatInt(now.Unix(), 10),
			SignType:  "RSA",
			PaySign:   uuid.NewString(),
		}
		raw, err := json.Marshal(response)
		prepayValue := prepayID
		return response, nil, &prepayValue, raw, err
	case paymentChannelAlipay:
		tradeNo := "trade_" + uuid.NewString()
		response := oapi.AlipayPayCreateResponse{
			OrderId:   orderID,
			Channel:   oapi.PaymentChannel(paymentChannelAlipay),
			Status:    oapi.PaymentStatus(paymentStatusPending),
			ExpiresAt: expiresAt,
			TradeNo:   tradeNo,
			PayParams: map[string]interface{}{
				"tradeNO": tradeNo,
			},
		}
		raw, err := json.Marshal(response)
		tradeValue := tradeNo
		return response, &tradeValue, nil, raw, err
	default:
		return nil, nil, nil, nil, fmt.Errorf("unsupported channel")
	}
}

func calculateOrderAmount(order CommerceOrder) int64 {
	var total int64
	for _, item := range order.Items {
		total += int64(item.Qty) * item.UnitPriceFen
	}
	return total
}

func isOrderPayable(orderStatus, paymentStatus string) bool {
	if strings.EqualFold(paymentStatus, "PAID") {
		return false
	}
	switch strings.ToUpper(strings.TrimSpace(orderStatus)) {
	case "SUBMITTED", "PAY_PENDING", "PAY_FAILED":
		return true
	default:
		return false
	}
}

func canAccessPayment(claims middleware.Claims, payment db.Payment) bool {
	role := strings.ToUpper(strings.TrimSpace(claims.Role))
	switch role {
	case "ADMIN", "MANAGER", "BOSS", "CS", "PROCUREMENT":
		return true
	}
	if !payment.PayerUserID.Valid {
		return true
	}
	return payment.PayerUserID.Bytes == claims.UserID
}

func toNullableUUID(value uuid.UUID) pgtype.UUID {
	if value == uuid.Nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: value, Valid: true}
}

func normalizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeNotifyPayload(payload map[string]interface{}) (normalizedNotifyPayload, error) {
	status := strings.ToUpper(strings.TrimSpace(readString(payload, "status", "trade_status", "paymentStatus")))
	if status == "" {
		status = paymentStatusPaid
	}
	switch status {
	case "SUCCESS":
		status = paymentStatusPaid
	case "FAILED":
		status = paymentStatusFailed
	case "CANCELLED":
		status = paymentStatusCancelled
	}

	paymentID := strings.TrimSpace(readString(payload, "paymentId", "payment_id"))
	if paymentID == "" {
		return normalizedNotifyPayload{}, fmt.Errorf("paymentId is required")
	}

	var providerTradeNo *string
	if value := readString(payload, "providerTradeNo", "provider_trade_no", "tradeNo", "trade_no", "out_trade_no"); strings.TrimSpace(value) != "" {
		trimmed := strings.TrimSpace(value)
		providerTradeNo = &trimmed
	}

	return normalizedNotifyPayload{
		PaymentID:       paymentID,
		Status:          status,
		ProviderTradeNo: providerTradeNo,
		EventType:       readString(payload, "eventType", "event_type"),
	}, nil
}

func normalizeWebhookEventType(eventType, status string) string {
	if strings.TrimSpace(eventType) != "" {
		return strings.TrimSpace(eventType)
	}
	return "payment." + strings.ToLower(strings.TrimSpace(status))
}

func readString(payload map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		value, ok := payload[key]
		if !ok {
			continue
		}
		if text, ok := value.(string); ok {
			return text
		}
	}
	return ""
}

func (h *Handler) recordAudit(ctx context.Context, paymentID uuid.UUID, action, actor, detail string) error {
	if h.Store == nil {
		return nil
	}
	_, err := h.Store.CreatePaymentAuditLog(ctx, db.CreatePaymentAuditLogParams{
		PaymentID: toNullableUUID(paymentID),
		Action:    action,
		Actor:     actor,
		Detail:    detail,
	})
	return err
}

type paymentHTTPError struct {
	status  int
	code    string
	message string
}

func (e paymentHTTPError) Error() string {
	return e.message
}

func errForbidden(message string) error {
	return paymentHTTPError{status: http.StatusForbidden, code: "feature_disabled", message: message}
}

func errConflict(message string) error {
	return paymentHTTPError{status: http.StatusConflict, code: "conflict", message: message}
}

func errNotFound(message string) error {
	return paymentHTTPError{status: http.StatusNotFound, code: "not_found", message: message}
}

func errBadRequest(message string) error {
	return paymentHTTPError{status: http.StatusBadRequest, code: "invalid_request", message: message}
}

func errInternal(message string) error {
	return paymentHTTPError{status: http.StatusInternalServerError, code: "internal_error", message: message}
}

func (h *Handler) writePaymentError(c *gin.Context, err error) {
	var httpErr paymentHTTPError
	if errors.As(err, &httpErr) {
		apierrors.Write(c, httpErr.status, apierrors.APIError{
			Code:    httpErr.code,
			Message: httpErr.message,
		})
		return
	}

	h.logError("payment request failed", err)
	apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
		Code:    "internal_error",
		Message: "payment request failed",
	})
}
