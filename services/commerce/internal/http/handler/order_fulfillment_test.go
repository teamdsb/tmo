package handler

import (
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

func TestResolveOrderFulfillmentTransition(t *testing.T) {
	salesID := uuid.New()
	onlinePaymentID := uuid.New()
	paidAt := pgtype.Timestamptz{Valid: true}

	tests := []struct {
		name           string
		order          db.Order
		confirmOffline bool
		wantStatus     string
		wantPayment    string
		wantChannel    *string
		wantClearPayID bool
		wantError      bool
	}{
		{
			name:           "offline payment confirms an unpaid order",
			order:          db.Order{Status: "SUBMITTED", PaymentStatus: "UNPAID"},
			confirmOffline: true, wantStatus: "CONFIRMED", wantPayment: "PAID",
			wantChannel: stringPointer("OFFLINE"), wantClearPayID: true,
		},
		{
			name:       "online paid order can be assigned without rewriting payment",
			order:      db.Order{Status: "PAID", PaymentStatus: "PAID", PaymentChannel: stringPointer("WECHAT"), LatestPaymentID: pgtype.UUID{Bytes: onlinePaymentID, Valid: true}, PaidAt: paidAt},
			wantStatus: "CONFIRMED", wantPayment: "PAID", wantChannel: stringPointer("WECHAT"),
		},
		{
			name:       "confirmed paid order can be reassigned",
			order:      db.Order{Status: "CONFIRMED", PaymentStatus: "PAID", OwnerSalesUserID: pgtype.UUID{Bytes: salesID, Valid: true}},
			wantStatus: "CONFIRMED", wantPayment: "PAID",
		},
		{name: "unpaid order cannot be assigned without payment confirmation", order: db.Order{Status: "SUBMITTED", PaymentStatus: "UNPAID"}, wantError: true},
		{name: "shipped order is immutable", order: db.Order{Status: "SHIPPED", PaymentStatus: "PAID"}, wantError: true},
		{name: "cancelled order is immutable", order: db.Order{Status: "CANCELLED", PaymentStatus: "UNPAID"}, confirmOffline: true, wantError: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := resolveOrderFulfillmentTransition(test.order, test.confirmOffline)
			if test.wantError {
				if err == nil {
					t.Fatal("expected transition error")
				}
				return
			}
			if err != nil {
				t.Fatalf("resolve transition: %v", err)
			}
			if got.status != test.wantStatus || got.paymentStatus != test.wantPayment {
				t.Fatalf("got status/payment %s/%s, want %s/%s", got.status, got.paymentStatus, test.wantStatus, test.wantPayment)
			}
			if stringValue(got.paymentChannel) != stringValue(test.wantChannel) {
				t.Fatalf("unexpected channel %v", got.paymentChannel)
			}
			if test.wantClearPayID && got.latestPaymentID.Valid {
				t.Fatal("expected online payment id to be cleared")
			}
			if test.confirmOffline && !got.paidAt.Valid {
				t.Fatal("expected paidAt")
			}
		})
	}
}

func TestValidateOrderFulfillmentRequest(t *testing.T) {
	if err := validateOrderFulfillmentInput(uuid.Nil, "note", "key"); err == nil {
		t.Fatal("expected missing sales user rejection")
	}
	if err := validateOrderFulfillmentInput(uuid.New(), "   ", "key"); err == nil {
		t.Fatal("expected blank note rejection")
	}
	if err := validateOrderFulfillmentInput(uuid.New(), "note", " "); err == nil {
		t.Fatal("expected blank idempotency key rejection")
	}
	if err := validateOrderFulfillmentInput(uuid.New(), "cash received", "request-1"); err != nil {
		t.Fatalf("valid input rejected: %v", err)
	}
}

func TestFulfillmentAction(t *testing.T) {
	if got := fulfillmentAction(db.Order{}, true); got != "OFFLINE_PAYMENT_AND_ASSIGN" {
		t.Fatalf("unexpected offline action %s", got)
	}
	if got := fulfillmentAction(db.Order{}, false); got != "ASSIGN" {
		t.Fatalf("unexpected assign action %s", got)
	}
	if got := fulfillmentAction(db.Order{OwnerSalesUserID: pgtype.UUID{Bytes: uuid.New(), Valid: true}}, false); got != "REASSIGN" {
		t.Fatalf("unexpected reassign action %s", got)
	}
}

func stringPointer(value string) *string { return &value }
func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
