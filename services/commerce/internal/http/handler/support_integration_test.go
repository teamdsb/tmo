package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

func TestSupportCurrentConversationCreatesSnapshotAndAdminCanReadSource(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	router := newAuthIntegrationRouter(pool, queries)

	customerID := uuid.New()
	ownerSalesID := uuid.New()

	req := httptest.NewRequest(http.MethodGet, "/support/conversations/current", nil)
	req.Header.Set("Authorization", "Bearer "+makeAuthTokenWithProfile(t, customerID, "CUSTOMER", &ownerSalesID, "用户0003", "+15550000003"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var current map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &current); err != nil {
		t.Fatalf("decode current conversation: %v", err)
	}
	if current["customerDisplayName"] != "用户0003" {
		t.Fatalf("expected customerDisplayName 用户0003, got %#v", current["customerDisplayName"])
	}
	if current["customerPhone"] != "+15550000003" {
		t.Fatalf("expected customerPhone +15550000003, got %#v", current["customerPhone"])
	}

	stored, err := queries.GetActiveSupportConversationByCustomer(context.Background(), customerID)
	if err != nil {
		t.Fatalf("load stored conversation: %v", err)
	}
	if stored.CustomerDisplayName == nil || *stored.CustomerDisplayName != "用户0003" {
		t.Fatalf("expected stored customerDisplayName 用户0003, got %#v", stored.CustomerDisplayName)
	}
	if stored.CustomerPhone == nil || *stored.CustomerPhone != "+15550000003" {
		t.Fatalf("expected stored customerPhone +15550000003, got %#v", stored.CustomerPhone)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/admin/support/conversations?scope=unassigned", nil)
	listReq.Header.Set("Authorization", "Bearer "+makeAuthToken(t, uuid.New(), "CS", nil))
	listRecorder := httptest.NewRecorder()
	router.ServeHTTP(listRecorder, listReq)

	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected admin list 200, got %d: %s", listRecorder.Code, listRecorder.Body.String())
	}

	var listPayload map[string]any
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &listPayload); err != nil {
		t.Fatalf("decode admin list: %v", err)
	}
	items, ok := listPayload["items"].([]any)
	if !ok || len(items) != 1 {
		t.Fatalf("expected 1 admin list item, got %#v", listPayload["items"])
	}
	item, _ := items[0].(map[string]any)
	if item["customerDisplayName"] != "用户0003" {
		t.Fatalf("expected list customerDisplayName 用户0003, got %#v", item["customerDisplayName"])
	}
	if item["customerPhone"] != "+15550000003" {
		t.Fatalf("expected list customerPhone +15550000003, got %#v", item["customerPhone"])
	}

	detailReq := httptest.NewRequest(http.MethodGet, "/admin/support/conversations/"+stored.ID.String(), nil)
	detailReq.Header.Set("Authorization", "Bearer "+makeAuthToken(t, uuid.New(), "CS", nil))
	detailRecorder := httptest.NewRecorder()
	router.ServeHTTP(detailRecorder, detailReq)

	if detailRecorder.Code != http.StatusOK {
		t.Fatalf("expected admin detail 200, got %d: %s", detailRecorder.Code, detailRecorder.Body.String())
	}

	var detailPayload map[string]any
	if err := json.Unmarshal(detailRecorder.Body.Bytes(), &detailPayload); err != nil {
		t.Fatalf("decode admin detail: %v", err)
	}
	conversation, _ := detailPayload["conversation"].(map[string]any)
	if conversation["customerDisplayName"] != "用户0003" {
		t.Fatalf("expected detail customerDisplayName 用户0003, got %#v", conversation["customerDisplayName"])
	}
	if conversation["customerPhone"] != "+15550000003" {
		t.Fatalf("expected detail customerPhone +15550000003, got %#v", conversation["customerPhone"])
	}
}

func TestSupportCurrentConversationRepairsMissingSnapshot(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	router := newAuthIntegrationRouter(pool, queries)

	customerID := uuid.New()
	conversation, err := queries.CreateSupportConversation(context.Background(), db.CreateSupportConversationParams{
		CustomerUserID:      customerID,
		CustomerDisplayName: nil,
		CustomerPhone:       nil,
		OwnerSalesUserID:    pgtype.UUID{},
		Status:              supportConversationStatusOpenUnassigned,
		Column10:            nil,
	})
	if err != nil {
		t.Fatalf("seed support conversation: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/support/conversations/current", nil)
	req.Header.Set("Authorization", "Bearer "+makeAuthTokenWithProfile(t, customerID, "CUSTOMER", nil, "用户0099", "+15550000999"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	stored, err := queries.GetSupportConversation(context.Background(), conversation.ID)
	if err != nil {
		t.Fatalf("reload support conversation: %v", err)
	}
	if stored.CustomerDisplayName == nil || *stored.CustomerDisplayName != "用户0099" {
		t.Fatalf("expected repaired customerDisplayName 用户0099, got %#v", stored.CustomerDisplayName)
	}
	if stored.CustomerPhone == nil || *stored.CustomerPhone != "+15550000999" {
		t.Fatalf("expected repaired customerPhone +15550000999, got %#v", stored.CustomerPhone)
	}
}
