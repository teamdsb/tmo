package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
	"github.com/teamdsb/tmo/services/payment/internal/http/oapi"
)

func (h *Handler) PostPaymentsWechatCreate(c *gin.Context, params oapi.PostPaymentsWechatCreateParams) {
	if !h.requireUser(c) {
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

	flags := h.getFeatureFlags(c)
	if !flags.PaymentEnabled || !flags.WechatPayEnabled {
		apierrors.Write(c, http.StatusForbidden, apierrors.APIError{
			Code:    "feature-disabled",
			Message: "wechat pay is disabled",
		})
		return
	}

	response := oapi.WechatPayCreateResponse{
		OrderId:   request.OrderId,
		PrepayId:  "prepay_" + uuid.NewString(),
		NonceStr:  uuid.NewString(),
		TimeStamp: strconv.FormatInt(time.Now().Unix(), 10),
		PaySign:   uuid.NewString(),
	}
	c.JSON(http.StatusOK, response)
}

func (h *Handler) PostPaymentsAlipayCreate(c *gin.Context, params oapi.PostPaymentsAlipayCreateParams) {
	if !h.requireUser(c) {
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

	flags := h.getFeatureFlags(c)
	if !flags.PaymentEnabled || !flags.AlipayPayEnabled {
		apierrors.Write(c, http.StatusForbidden, apierrors.APIError{
			Code:    "feature-disabled",
			Message: "alipay is disabled",
		})
		return
	}

	response := oapi.AlipayPayCreateResponse{
		OrderId: request.OrderId,
		TradeNo: "trade_" + uuid.NewString(),
		PayParams: map[string]interface{}{
			"timestamp": time.Now().Unix(),
		},
	}
	c.JSON(http.StatusOK, response)
}

func (h *Handler) PostPaymentsWechatNotify(c *gin.Context) {
	var payload oapi.PostPaymentsWechatNotifyJSONBody
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
	c.Status(http.StatusOK)
}

func (h *Handler) getFeatureFlags(c *gin.Context) FeatureFlags {
	if h.Flags == nil {
		return FeatureFlags{}
	}
	flags, err := h.Flags.GetFlags(c.Request.Context())
	if err != nil {
		h.logError("fetch feature flags failed", err)
	}
	return flags
}
