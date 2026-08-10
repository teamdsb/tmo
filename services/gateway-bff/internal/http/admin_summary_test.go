package http

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type blockingRoundTripper struct {
	started chan string
	release <-chan struct{}
	bodies  map[string]string
}

func (transport *blockingRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	transport.started <- req.URL.Path
	select {
	case <-transport.release:
	case <-req.Context().Done():
		return nil, req.Context().Err()
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Status:     "200 OK",
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(transport.bodies[req.URL.Path])),
		Request:    req,
	}, nil
}

func TestAdminSummaryStartsIndependentUpstreamsConcurrently(t *testing.T) {
	gin.SetMode(gin.TestMode)
	started := make(chan string, 5)
	release := make(chan struct{})
	var releaseOnce sync.Once
	releaseAll := func() { releaseOnce.Do(func() { close(release) }) }
	t.Cleanup(releaseAll)

	client := &http.Client{Transport: &blockingRoundTripper{
		started: started,
		release: release,
		bodies: map[string]string{
			"/admin/config/feature-flags": `{"paymentEnabled":true}`,
			"/catalog/products":           `{"total":4}`,
			"/orders":                     `{"total":2,"items":[{"status":"SUBMITTED"},{"status":"COMPLETE"}]}`,
			"/inquiries/price":            `{"total":3,"items":[{"status":"OPEN"}]}`,
			"/product-requests":           `{"total":5}`,
		},
	}}
	handler := NewAdminSummaryHandler("https://identity.example", "https://commerce.example", client, nil)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/bff/admin/summary", nil)
	ctx.Request.Header.Set("Authorization", "Bearer token-1")

	done := make(chan struct{})
	go func() {
		handler.Handle(ctx)
		close(done)
	}()

	seen := make(map[string]bool)
	deadline := time.NewTimer(time.Second)
	defer deadline.Stop()
	for len(seen) < 5 {
		select {
		case path := <-started:
			seen[path] = true
		case <-deadline.C:
			releaseAll()
			<-done
			t.Fatalf("only %d independent upstreams started before release: %#v", len(seen), seen)
		}
	}
	releaseAll()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("handler did not finish after releasing upstreams")
	}

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	var response AdminSummaryResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Metrics.ProductsTotal != 4 || response.Metrics.OrdersPending != 1 || response.Metrics.ProductRequestsTotal != 5 {
		t.Fatalf("unexpected metrics %#v", response.Metrics)
	}
	if !response.FeatureFlags["paymentEnabled"] || len(response.WarningLabels) != 0 {
		t.Fatalf("unexpected flags/warnings flags=%#v warnings=%#v", response.FeatureFlags, response.WarningLabels)
	}
}
