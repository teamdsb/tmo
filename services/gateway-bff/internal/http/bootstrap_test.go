package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestAuthenticatedBootstrapStartsIndependentUpstreamsConcurrently(t *testing.T) {
	gin.SetMode(gin.TestMode)
	started := make(chan string, 3)
	release := make(chan struct{})
	var releaseOnce sync.Once
	releaseAll := func() { releaseOnce.Do(func() { close(release) }) }
	t.Cleanup(releaseAll)

	client := &http.Client{Transport: &blockingRoundTripper{
		started: started,
		release: release,
		bodies: map[string]string{
			"/admin/config/feature-flags": `{"paymentEnabled":true}`,
			"/me":                         `{"id":"user-1"}`,
			"/me/permissions":             `{"items":["orders:read"]}`,
		},
	}}
	handler := NewBootstrapHandler("https://identity.example", client, nil)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/bff/bootstrap", nil)
	ctx.Request.Header.Set("Authorization", "Bearer token-1")

	done := make(chan struct{})
	go func() {
		handler.Handle(ctx)
		close(done)
	}()

	seen := make(map[string]bool)
	deadline := time.NewTimer(time.Second)
	defer deadline.Stop()
	for len(seen) < 3 {
		select {
		case path := <-started:
			seen[path] = true
		case <-deadline.C:
			releaseAll()
			<-done
			t.Fatalf("only %d bootstrap upstreams started before release: %#v", len(seen), seen)
		}
	}
	releaseAll()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("bootstrap did not finish after releasing upstreams")
	}

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	var payload struct {
		Me           map[string]any `json:"me"`
		Permissions  map[string]any `json:"permissions"`
		FeatureFlags map[string]any `json:"featureFlags"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Me["id"] != "user-1" || payload.FeatureFlags["paymentEnabled"] != true {
		t.Fatalf("unexpected bootstrap payload %#v", payload)
	}
}
