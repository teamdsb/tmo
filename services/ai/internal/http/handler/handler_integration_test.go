package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/ai/internal/commerce"
	httpserver "github.com/teamdsb/tmo/services/ai/internal/http"
	"github.com/teamdsb/tmo/services/ai/internal/http/handler"
	"github.com/teamdsb/tmo/services/ai/internal/http/middleware"
	"github.com/teamdsb/tmo/services/ai/internal/knowledge"
	"github.com/teamdsb/tmo/services/ai/internal/provider"
)

type staticKnowledge struct {
	result knowledge.SearchResult
}

func (s staticKnowledge) Search(string, int) knowledge.SearchResult {
	return s.result
}

type staticProvider struct {
	suggestions []string
	err         error
}

func (s staticProvider) Suggest(context.Context, provider.SuggestionInput) ([]string, error) {
	return s.suggestions, s.err
}

func TestPostAiAfterSalesSuggestionsUnauthorizedWithoutBearerToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := httpserver.NewRouter(&handler.Handler{
		Auth:        middleware.NewAuthenticator(true, "dev-secret", "test-issuer"),
		Commerce:    nil,
		Knowledge:   staticKnowledge{},
		Suggestions: staticProvider{},
	}, nil, nil)

	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/ai/after-sales/suggestions", strings.NewReader(`{"ticketId":"11111111-1111-1111-1111-111111111111"}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func TestPostAiAfterSalesSuggestionsForwardsAuthAndRequestIDToCommerce(t *testing.T) {
	gin.SetMode(gin.TestMode)

	ticketID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	messageID := uuid.MustParse("22222222-2222-2222-2222-222222222222")

	var mu sync.Mutex
	seenPaths := make([]string, 0, 2)
	seenAuth := make([]string, 0, 2)
	seenRequestIDs := make([]string, 0, 2)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		seenPaths = append(seenPaths, r.URL.Path)
		seenAuth = append(seenAuth, r.Header.Get("Authorization"))
		seenRequestIDs = append(seenRequestIDs, r.Header.Get("X-Request-ID"))
		mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/after-sales/tickets/" + ticketID.String():
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":          ticketID.String(),
				"status":      "OPEN",
				"subject":     "包装破损",
				"description": "阻燃电缆外包装破损",
			})
		case "/after-sales/tickets/" + ticketID.String() + "/messages":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"items": []map[string]any{
					{
						"id":         messageID.String(),
						"ticketId":   ticketID.String(),
						"senderType": "customer",
						"content":    "收到的阻燃电缆 100m/卷 外箱破损",
						"createdAt":  time.Now().UTC().Format(time.RFC3339),
					},
				},
				"page":     1,
				"pageSize": 100,
				"total":    1,
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	router := httpserver.NewRouter(&handler.Handler{
		Auth:     middleware.NewAuthenticator(true, "dev-secret", "test-issuer"),
		Commerce: commerce.NewClient(upstream.URL, time.Second),
		Knowledge: staticKnowledge{result: knowledge.SearchResult{
			Products: []knowledge.ProductMatch{{Document: knowledge.ProductDocument{Name: "阻燃电缆 3x2.5"}}},
			Templates: []knowledge.TemplateMatch{{Template: knowledge.Template{
				ID:      "packaging-damage",
				Name:    "包装破损",
				Empathy: "给您带来麻烦了，我们先协助核实包装和货物受损情况。",
			}}},
		}},
		Suggestions: staticProvider{suggestions: []string{"建议 1", "建议 2", "建议 3"}},
	}, nil, nil)

	body := bytes.NewBufferString(`{"ticketId":"11111111-1111-1111-1111-111111111111","latestMessageId":"22222222-2222-2222-2222-222222222222"}`)
	req := httptest.NewRequest(http.MethodPost, "/ai/after-sales/suggestions", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+signToken(t, "dev-secret", "test-issuer", "CUSTOMER"))
	req.Header.Set("X-Request-ID", "req-test-1")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"suggestions":["建议 1","建议 2","建议 3"]`) {
		t.Fatalf("expected suggestion payload, got %s", recorder.Body.String())
	}

	mu.Lock()
	defer mu.Unlock()
	if len(seenPaths) != 2 {
		t.Fatalf("expected 2 upstream requests, got %d", len(seenPaths))
	}
	for _, value := range seenAuth {
		if !strings.HasPrefix(value, "Bearer ") {
			t.Fatalf("expected bearer auth forwarding, got %q", value)
		}
	}
	for _, value := range seenRequestIDs {
		if value != "req-test-1" {
			t.Fatalf("expected forwarded request id req-test-1, got %q", value)
		}
	}
}

func TestPostAiAfterSalesSuggestionsReturnsTicketNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	ticketID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]any{"code": "not_found", "message": "not found"})
	}))
	defer upstream.Close()

	router := httpserver.NewRouter(&handler.Handler{
		Auth:        middleware.NewAuthenticator(true, "dev-secret", "test-issuer"),
		Commerce:    commerce.NewClient(upstream.URL, time.Second),
		Knowledge:   staticKnowledge{},
		Suggestions: staticProvider{suggestions: []string{"unused"}},
	}, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/ai/after-sales/suggestions", strings.NewReader(`{"ticketId":"`+ticketID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+signToken(t, "dev-secret", "test-issuer", "CUSTOMER"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"ticket_not_found"`) {
		t.Fatalf("expected ticket_not_found, got %s", recorder.Body.String())
	}
}

func TestPostAiAfterSalesSuggestionsRejectsUnknownLatestMessageID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	ticketID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	knownMessageID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	unknownMessageID := uuid.MustParse("33333333-3333-3333-3333-333333333333")

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/after-sales/tickets/" + ticketID.String():
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":          ticketID.String(),
				"status":      "OPEN",
				"subject":     "规格不符",
				"description": "型号不一致",
			})
		case "/after-sales/tickets/" + ticketID.String() + "/messages":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"items": []map[string]any{
					{
						"id":         knownMessageID.String(),
						"ticketId":   ticketID.String(),
						"senderType": "customer",
						"content":    "收到的型号不对",
						"createdAt":  time.Now().UTC().Format(time.RFC3339),
					},
				},
				"page":     1,
				"pageSize": 100,
				"total":    1,
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	router := httpserver.NewRouter(&handler.Handler{
		Auth:        middleware.NewAuthenticator(true, "dev-secret", "test-issuer"),
		Commerce:    commerce.NewClient(upstream.URL, time.Second),
		Knowledge:   staticKnowledge{},
		Suggestions: staticProvider{suggestions: []string{"unused"}},
	}, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/ai/after-sales/suggestions", strings.NewReader(`{"ticketId":"`+ticketID.String()+`","latestMessageId":"`+unknownMessageID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+signToken(t, "dev-secret", "test-issuer", "CUSTOMER"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"invalid_request"`) {
		t.Fatalf("expected invalid_request, got %s", recorder.Body.String())
	}
}

func TestPostAiAfterSalesSuggestionsMapsCommerceUpstreamFailure(t *testing.T) {
	gin.SetMode(gin.TestMode)

	ticketID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]any{"code": "internal_error", "message": "boom"})
	}))
	defer upstream.Close()

	router := httpserver.NewRouter(&handler.Handler{
		Auth:        middleware.NewAuthenticator(true, "dev-secret", "test-issuer"),
		Commerce:    commerce.NewClient(upstream.URL, time.Second),
		Knowledge:   staticKnowledge{},
		Suggestions: staticProvider{suggestions: []string{"unused"}},
	}, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/ai/after-sales/suggestions", strings.NewReader(`{"ticketId":"`+ticketID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+signToken(t, "dev-secret", "test-issuer", "CUSTOMER"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"commerce_unavailable"`) {
		t.Fatalf("expected commerce_unavailable, got %s", recorder.Body.String())
	}
}

func TestPostAiAfterSalesSuggestionsWithoutLatestMessageIDUsesFullConversation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	ticketID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/after-sales/tickets/" + ticketID.String():
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":          ticketID.String(),
				"status":      "OPEN",
				"subject":     "发货延迟",
				"description": "客户催发货",
			})
		case "/after-sales/tickets/" + ticketID.String() + "/messages":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"items": []map[string]any{
					{
						"id":         "22222222-2222-2222-2222-222222222222",
						"ticketId":   ticketID.String(),
						"senderType": "customer",
						"content":    "什么时候发货",
						"createdAt":  time.Now().UTC().Format(time.RFC3339),
					},
				},
				"page":     1,
				"pageSize": 100,
				"total":    1,
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	router := httpserver.NewRouter(&handler.Handler{
		Auth:        middleware.NewAuthenticator(true, "dev-secret", "test-issuer"),
		Commerce:    commerce.NewClient(upstream.URL, time.Second),
		Knowledge:   staticKnowledge{},
		Suggestions: staticProvider{suggestions: []string{"建议 1", "建议 2"}},
	}, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/ai/after-sales/suggestions", strings.NewReader(`{"ticketId":"`+ticketID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+signToken(t, "dev-secret", "test-issuer", "CUSTOMER"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestPostAiAfterSalesSuggestionsReturnsProviderUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)

	ticketID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/after-sales/tickets/" + ticketID.String():
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":          ticketID.String(),
				"status":      "OPEN",
				"subject":     "责任待确认",
				"description": "需要进一步确认",
			})
		case "/after-sales/tickets/" + ticketID.String() + "/messages":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"items":    []map[string]any{},
				"page":     1,
				"pageSize": 100,
				"total":    0,
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	router := httpserver.NewRouter(&handler.Handler{
		Auth:        middleware.NewAuthenticator(true, "dev-secret", "test-issuer"),
		Commerce:    commerce.NewClient(upstream.URL, time.Second),
		Knowledge:   staticKnowledge{},
		Suggestions: staticProvider{err: errors.New("provider down")},
	}, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/ai/after-sales/suggestions", strings.NewReader(`{"ticketId":"`+ticketID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+signToken(t, "dev-secret", "test-issuer", "CUSTOMER"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"ai_provider_unavailable"`) {
		t.Fatalf("expected ai_provider_unavailable, got %s", recorder.Body.String())
	}
}

func signToken(t *testing.T, secret, issuer, role string) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"iss":  issuer,
		"sub":  "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		"role": role,
	})

	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("SignedString() error = %v", err)
	}
	return signed
}
