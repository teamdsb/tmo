package handler

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/teamdsb/tmo/services/payment/internal/db"
)

// ReconcilePayment shares persistence and Commerce synchronization with HTTP
// requests, and never uses a client's success/cancellation as payment evidence.
func (h *Handler) ReconcilePayment(ctx context.Context, claimed db.Payment) (db.Payment, error) {
	if h.Store == nil || h.Commerce == nil {
		return claimed, errors.New("payment reconciliation dependencies are not configured")
	}
	payment, err := h.Store.GetPayment(ctx, claimed.ID)
	if err != nil {
		return claimed, fmt.Errorf("load payment for reconciliation: %w", err)
	}
	var queryErr error
	if payment.Channel == paymentChannelWechatB2B && payment.Status == paymentStatusPending &&
		strings.EqualFold(strings.TrimSpace(h.ProviderMode), "b2b") && h.WechatB2B != nil {
		resolution, err := h.WechatB2B.QueryPayment(ctx, WechatB2BQueryRequest{OrderID: payment.OrderID, AmountFen: payment.AmountFen})
		if err != nil {
			queryErr = fmt.Errorf("query B2B payment: %w", err)
		} else if resolution.Status != paymentStatusPending {
			_, queryErr = h.persistPaymentResolution(ctx, payment, resolution.Status, normalizeOptionalString(&resolution.ProviderTradeNo), nil)
		}
	}
	// Querying can race a successful HTTP recheck or callback. Always sync the
	// latest saved snapshot, and do not let a provider error hide a saved PAID.
	payment, err = h.Store.GetPayment(ctx, claimed.ID)
	if err != nil {
		return claimed, errors.Join(queryErr, fmt.Errorf("reload payment for synchronization: %w", err))
	}
	if payment.Status == paymentStatusPaid {
		queryErr = nil
	}
	var syncErr error
	if payment.StateVersion > payment.CommerceSyncedVersion {
		syncErr = h.syncPaymentToCommerce(ctx, payment)
	}
	return payment, errors.Join(queryErr, syncErr)
}
