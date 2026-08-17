package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
)

func TestSupportExplicitClaimOwnsReadAndSend(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	router := newAuthIntegrationRouter(pool, queries)

	customerID := uuid.New()
	csAID := uuid.New()
	csBID := uuid.New()

	currentReq := httptest.NewRequest(http.MethodGet, "/support/conversations/current", nil)
	currentReq.Header.Set("Authorization", "Bearer "+makeAuthToken(t, customerID, "CUSTOMER", nil))
	currentRecorder := httptest.NewRecorder()
	router.ServeHTTP(currentRecorder, currentReq)
	if currentRecorder.Code != http.StatusOK {
		t.Fatalf("create current conversation: got %d: %s", currentRecorder.Code, currentRecorder.Body.String())
	}
	var current map[string]any
	if err := json.Unmarshal(currentRecorder.Body.Bytes(), &current); err != nil {
		t.Fatalf("decode current conversation: %v", err)
	}
	conversationID, err := uuid.Parse(current["id"].(string))
	if err != nil {
		t.Fatalf("parse conversation id: %v", err)
	}

	customerMessageBody := []byte(`{"messageType":"TEXT","text":"Need help"}`)
	customerMessageReq := httptest.NewRequest(http.MethodPost, "/support/conversations/"+conversationID.String()+"/messages", bytes.NewReader(customerMessageBody))
	customerMessageReq.Header.Set("Authorization", "Bearer "+makeAuthToken(t, customerID, "CUSTOMER", nil))
	customerMessageReq.Header.Set("Content-Type", "application/json")
	customerMessageRecorder := httptest.NewRecorder()
	router.ServeHTTP(customerMessageRecorder, customerMessageReq)
	if customerMessageRecorder.Code != http.StatusCreated {
		t.Fatalf("seed customer message: got %d: %s", customerMessageRecorder.Code, customerMessageRecorder.Body.String())
	}

	assertStaffRequestStatus := func(name string, staffID uuid.UUID, method, path string, body []byte, want int) {
		t.Helper()
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequest(method, path, bytes.NewReader(body))
			req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, staffID, "CS", nil))
			if len(body) > 0 {
				req.Header.Set("Content-Type", "application/json")
			}
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, req)
			if recorder.Code != want {
				t.Fatalf("expected status %d, got %d: %s", want, recorder.Code, recorder.Body.String())
			}
		})
	}

	readPath := "/support/conversations/" + conversationID.String() + "/read"
	messagePath := "/support/conversations/" + conversationID.String() + "/messages"
	uploadPath := "/support/conversations/" + conversationID.String() + "/messages/image"
	staffMessageBody := []byte(`{"messageType":"TEXT","text":"I can help"}`)
	claimPath := "/admin/support/conversations/" + conversationID.String() + "/claim"
	releasePath := "/admin/support/conversations/" + conversationID.String() + "/release"
	transferPath := "/admin/support/conversations/" + conversationID.String() + "/transfer"
	transferBody := []byte(`{"toUserId":"` + csBID.String() + `","toRole":"CS"}`)

	assertStaffRequestStatus("unassigned read is forbidden", csAID, http.MethodPost, readPath, nil, http.StatusForbidden)
	assertStaffRequestStatus("unassigned send is forbidden", csAID, http.MethodPost, messagePath, staffMessageBody, http.StatusForbidden)
	assertStaffRequestStatus("unassigned upload is forbidden", csAID, http.MethodPost, uploadPath, nil, http.StatusForbidden)
	assertStaffRequestStatus("claim succeeds", csAID, http.MethodPost, claimPath, nil, http.StatusOK)
	assertStaffRequestStatus("owner read succeeds", csAID, http.MethodPost, readPath, nil, http.StatusOK)
	assertStaffRequestStatus("owner send succeeds", csAID, http.MethodPost, messagePath, staffMessageBody, http.StatusCreated)
	assertStaffRequestStatus("owner upload reaches file validation", csAID, http.MethodPost, uploadPath, nil, http.StatusBadRequest)
	assertStaffRequestStatus("other staff read is forbidden", csBID, http.MethodPost, readPath, nil, http.StatusForbidden)
	assertStaffRequestStatus("other staff send is forbidden", csBID, http.MethodPost, messagePath, staffMessageBody, http.StatusForbidden)
	assertStaffRequestStatus("other staff upload is forbidden", csBID, http.MethodPost, uploadPath, nil, http.StatusForbidden)
	assertStaffRequestStatus("other staff release is forbidden", csBID, http.MethodPost, releasePath, nil, http.StatusForbidden)
	assertStaffRequestStatus("other staff transfer is forbidden", csBID, http.MethodPost, transferPath, transferBody, http.StatusForbidden)
}

func TestSupportProductCardUsesCatalogSnapshot(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	router := newAuthIntegrationRouter(pool, queries)
	ctx := context.Background()

	customerID := uuid.New()
	csID := uuid.New()
	conversation, _, err := (&Handler{SupportStore: queries, DB: pool}).ensureActiveSupportConversation(ctx, middleware.Claims{
		UserID: customerID,
		Role:   "CUSTOMER",
	})
	if err != nil {
		t.Fatalf("create support conversation: %v", err)
	}
	if _, err := queries.ClaimSupportConversation(ctx, db.ClaimSupportConversationParams{
		ID:             conversation.ID,
		AssigneeUserID: pgtype.UUID{Bytes: csID, Valid: true},
		AssigneeRole:   stringPtr("CS"),
	}); err != nil {
		t.Fatalf("claim support conversation: %v", err)
	}

	category, err := queries.CreateCategory(ctx, db.CreateCategoryParams{Name: "Fasteners", Sort: 0})
	if err != nil {
		t.Fatalf("create category: %v", err)
	}
	coverURL := "https://example.com/catalog-bolt.png"
	activeProduct, err := queries.CreateProduct(ctx, db.CreateProductParams{
		Name:          "Catalog Bolt",
		CategoryID:    category.ID,
		CoverImageUrl: &coverURL,
		Images:        []string{coverURL},
		Tags:          []string{},
		Status:        productStatusActive,
	})
	if err != nil {
		t.Fatalf("create active product: %v", err)
	}
	inactiveProduct, err := queries.CreateProduct(ctx, db.CreateProductParams{
		Name:       "Inactive Bolt",
		CategoryID: category.ID,
		Images:     []string{},
		Tags:       []string{},
		Status:     productStatusInactive,
	})
	if err != nil {
		t.Fatalf("create inactive product: %v", err)
	}

	postProductCard := func(productID string) *httptest.ResponseRecorder {
		t.Helper()
		body := []byte(`{"messageType":"PRODUCT_CARD","cardPayload":{"productId":"` + productID + `","title":"Forged"}}`)
		req := httptest.NewRequest(http.MethodPost, "/support/conversations/"+conversation.ID.String()+"/messages", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, csID, "CS", nil))
		req.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		return recorder
	}

	successRecorder := postProductCard(activeProduct.ID.String())
	if successRecorder.Code != http.StatusCreated {
		t.Fatalf("send active product card: got %d: %s", successRecorder.Code, successRecorder.Body.String())
	}
	var successPayload map[string]any
	if err := json.Unmarshal(successRecorder.Body.Bytes(), &successPayload); err != nil {
		t.Fatalf("decode product card response: %v", err)
	}
	card, _ := successPayload["cardPayload"].(map[string]any)
	if card["title"] != "Catalog Bolt" || card["imageUrl"] != coverURL {
		t.Fatalf("expected catalog-backed card, got %#v", card)
	}
	if card["route"] != "/pages/goods/detail/index?id="+activeProduct.ID.String() {
		t.Fatalf("expected miniapp product route, got %#v", card["route"])
	}

	messageCount, err := queries.CountSupportMessages(ctx, conversation.ID)
	if err != nil {
		t.Fatalf("count support messages: %v", err)
	}
	for name, productID := range map[string]string{
		"malformed": "not-a-uuid",
		"missing":   uuid.NewString(),
		"inactive":  inactiveProduct.ID.String(),
	} {
		t.Run(name, func(t *testing.T) {
			recorder := postProductCard(productID)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
			}
			currentCount, countErr := queries.CountSupportMessages(ctx, conversation.ID)
			if countErr != nil {
				t.Fatalf("count support messages: %v", countErr)
			}
			if currentCount != messageCount {
				t.Fatalf("invalid product created a message: count = %d, want %d", currentCount, messageCount)
			}
		})
	}
}

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
	if current["queuedAt"] == nil {
		t.Fatalf("expected queuedAt in current conversation, got %#v", current)
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
	if !stored.QueuedAt.Valid {
		t.Fatalf("expected stored queuedAt")
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

	csID := uuid.New()
	claimReq := httptest.NewRequest(http.MethodPost, "/admin/support/conversations/"+stored.ID.String()+"/claim", nil)
	claimReq.Header.Set("Authorization", "Bearer "+makeAuthToken(t, csID, "CS", nil))
	claimRecorder := httptest.NewRecorder()
	router.ServeHTTP(claimRecorder, claimReq)
	if claimRecorder.Code != http.StatusOK {
		t.Fatalf("expected claim status 200, got %d: %s", claimRecorder.Code, claimRecorder.Body.String())
	}
	var claimed map[string]any
	if err := json.Unmarshal(claimRecorder.Body.Bytes(), &claimed); err != nil {
		t.Fatalf("decode claimed conversation: %v", err)
	}
	if claimed["status"] != supportConversationStatusOpenAssigned || claimed["assignedAt"] == nil {
		t.Fatalf("expected assigned conversation timestamps, got %#v", claimed)
	}

	releaseReq := httptest.NewRequest(http.MethodPost, "/admin/support/conversations/"+stored.ID.String()+"/release", nil)
	releaseReq.Header.Set("Authorization", "Bearer "+makeAuthToken(t, csID, "CS", nil))
	releaseRecorder := httptest.NewRecorder()
	router.ServeHTTP(releaseRecorder, releaseReq)
	if releaseRecorder.Code != http.StatusOK {
		t.Fatalf("expected release status 200, got %d: %s", releaseRecorder.Code, releaseRecorder.Body.String())
	}
	var released map[string]any
	if err := json.Unmarshal(releaseRecorder.Body.Bytes(), &released); err != nil {
		t.Fatalf("decode released conversation: %v", err)
	}
	if released["status"] != supportConversationStatusOpenUnassigned || released["assignedAt"] != nil || released["queuedAt"] == nil {
		t.Fatalf("expected requeued conversation timestamps, got %#v", released)
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
