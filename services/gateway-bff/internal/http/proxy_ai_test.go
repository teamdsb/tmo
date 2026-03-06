package http

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestProxyHandlerAIReturnsNotImplementedWhenDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()

	handler, err := NewProxyHandler(upstream.URL, upstream.URL, upstream.URL, "", slog.New(slog.NewTextHandler(io.Discard, nil)), 0)
	if err != nil {
		t.Fatalf("NewProxyHandler() error = %v", err)
	}

	router := gin.New()
	router.POST("/ai/after-sales/suggestions", handler.AI)
	server := httptest.NewServer(router)
	defer server.Close()

	resp, err := http.Post(server.URL+"/ai/after-sales/suggestions", "application/json", nil)
	if err != nil {
		t.Fatalf("http.Post() error = %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotImplemented {
		t.Fatalf("expected 501, got %d", resp.StatusCode)
	}
}

func TestProxyHandlerAIProxiesWhenConfigured(t *testing.T) {
	gin.SetMode(gin.TestMode)

	aiUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer aiUpstream.Close()

	otherUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer otherUpstream.Close()

	handler, err := NewProxyHandler(otherUpstream.URL, otherUpstream.URL, otherUpstream.URL, aiUpstream.URL, slog.New(slog.NewTextHandler(io.Discard, nil)), 0)
	if err != nil {
		t.Fatalf("NewProxyHandler() error = %v", err)
	}

	router := gin.New()
	router.POST("/ai/after-sales/suggestions", handler.AI)
	server := httptest.NewServer(router)
	defer server.Close()

	resp, err := http.Post(server.URL+"/ai/after-sales/suggestions", "application/json", nil)
	if err != nil {
		t.Fatalf("http.Post() error = %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.StatusCode, string(body))
	}
	if string(body) != `{"ok":true}` {
		t.Fatalf("expected proxied body, got %s", string(body))
	}
}
