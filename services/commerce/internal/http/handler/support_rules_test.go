package handler

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

func TestCanOperateSupportConversationRequiresCurrentAssignee(t *testing.T) {
	ownerID := uuid.New()
	otherID := uuid.New()

	tests := []struct {
		name         string
		conversation db.SupportConversation
		userID       uuid.UUID
		want         bool
	}{
		{name: "unassigned", conversation: db.SupportConversation{}, userID: ownerID, want: false},
		{
			name: "current assignee",
			conversation: db.SupportConversation{
				AssigneeUserID: pgtype.UUID{Bytes: ownerID, Valid: true},
			},
			userID: ownerID,
			want:   true,
		},
		{
			name: "other assignee",
			conversation: db.SupportConversation{
				AssigneeUserID: pgtype.UUID{Bytes: otherID, Valid: true},
			},
			userID: ownerID,
			want:   false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := canOperateSupportConversation(test.conversation, test.userID); got != test.want {
				t.Fatalf("canOperateSupportConversation() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestSupportAssignmentManagementRespectsOwnership(t *testing.T) {
	ownerID := uuid.New()
	otherID := uuid.New()
	unassigned := db.SupportConversation{}
	assigned := db.SupportConversation{
		AssigneeUserID: pgtype.UUID{Bytes: ownerID, Valid: true},
	}

	if canManageSupportAssignment("MANAGER", unassigned, otherID) {
		t.Fatal("manager should not release an unassigned conversation")
	}
	if !canManageSupportAssignment("MANAGER", assigned, otherID) {
		t.Fatal("manager should be able to release an assigned conversation")
	}
	if !canManageSupportAssignment("CS", assigned, ownerID) {
		t.Fatal("owning CS should be able to release the conversation")
	}
	if canManageSupportAssignment("CS", assigned, otherID) {
		t.Fatal("non-owning CS should not release the conversation")
	}
	if !canManageSupportTransfer("MANAGER", assigned, otherID) {
		t.Fatal("manager should be able to transfer an assigned conversation")
	}
	if !canManageSupportTransfer("CS", assigned, ownerID) {
		t.Fatal("owning CS should be able to transfer the conversation")
	}
	if canManageSupportTransfer("CS", assigned, otherID) {
		t.Fatal("non-owning CS should not transfer the conversation")
	}
}

func TestBuildSupportProductCardPayloadUsesActiveCatalogProduct(t *testing.T) {
	productID := uuid.New()
	coverURL := "https://example.com/bolt.png"
	store := &stubStore{
		getProductFn: func(_ context.Context, gotID uuid.UUID) (db.CatalogProduct, error) {
			if gotID != productID {
				t.Fatalf("GetProduct id = %s, want %s", gotID, productID)
			}
			return db.CatalogProduct{
				ID:            productID,
				Name:          "Catalog Bolt",
				CoverImageUrl: &coverURL,
				Status:        productStatusActive,
			}, nil
		},
	}

	payload, err := buildSupportProductCardPayload(
		context.Background(),
		store,
		json.RawMessage(`{"productId":"`+productID.String()+`","title":"Forged title","imageUrl":"https://evil.example/image.png"}`),
	)
	if err != nil {
		t.Fatalf("buildSupportProductCardPayload() error = %v", err)
	}

	var card map[string]any
	if err := json.Unmarshal(payload, &card); err != nil {
		t.Fatalf("decode product card: %v", err)
	}
	want := map[string]string{
		"title":     "Catalog Bolt",
		"subtitle":  "点击查看商品详情",
		"productId": productID.String(),
		"imageUrl":  coverURL,
		"route":     "/pages/goods/detail/index?id=" + productID.String(),
	}
	for key, wantValue := range want {
		if got := card[key]; got != wantValue {
			t.Errorf("card[%q] = %#v, want %q", key, got, wantValue)
		}
	}
}

func TestBuildSupportProductCardPayloadRejectsInvalidProducts(t *testing.T) {
	activeID := uuid.New()
	inactiveID := uuid.New()
	missingID := uuid.New()
	store := &stubStore{
		getProductFn: func(_ context.Context, productID uuid.UUID) (db.CatalogProduct, error) {
			switch productID {
			case inactiveID:
				return db.CatalogProduct{ID: inactiveID, Name: "Inactive", Status: productStatusInactive}, nil
			case missingID:
				return db.CatalogProduct{}, pgx.ErrNoRows
			case activeID:
				return db.CatalogProduct{ID: activeID, Name: "Active", Status: productStatusActive}, nil
			default:
				return db.CatalogProduct{}, errors.New("unexpected product")
			}
		},
	}

	tests := []struct {
		name    string
		payload string
	}{
		{name: "missing product id", payload: `{}`},
		{name: "malformed product id", payload: `{"productId":"not-a-uuid"}`},
		{name: "missing product", payload: `{"productId":"` + missingID.String() + `"}`},
		{name: "inactive product", payload: `{"productId":"` + inactiveID.String() + `"}`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := buildSupportProductCardPayload(context.Background(), store, json.RawMessage(test.payload))
			if err == nil || !strings.Contains(err.Error(), "invalid request") {
				t.Fatalf("buildSupportProductCardPayload() error = %v, want invalid request", err)
			}
		})
	}
}
