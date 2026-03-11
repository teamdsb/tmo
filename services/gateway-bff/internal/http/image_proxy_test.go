package http

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestImageProxyHandleMissingURL(t *testing.T) {
	t.Parallel()

	router := newImageProxyTestRouter(NewImageProxyHandler(nil, []string{"images.unsplash.com"}, time.Second, 1024, 60, nil))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/assets/img", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "\"code\":\"missing_image_url\"") {
		t.Fatalf("expected missing_image_url error, got %s", recorder.Body.String())
	}
}

func TestImageProxyHandleForbiddenHost(t *testing.T) {
	t.Parallel()

	router := newImageProxyTestRouter(NewImageProxyHandler(nil, []string{"images.unsplash.com"}, time.Second, 1024, 60, nil))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/assets/img?url="+url.QueryEscape("https://example.com/a.jpg"), nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "\"code\":\"image_host_not_allowed\"") {
		t.Fatalf("expected image_host_not_allowed error, got %s", recorder.Body.String())
	}
}

func TestImageProxyHandleSuccess(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/jpeg")
		_, _ = w.Write([]byte("image-binary"))
	}))
	defer upstream.Close()

	upstreamURL, err := url.Parse(upstream.URL)
	if err != nil {
		t.Fatalf("parse upstream url: %v", err)
	}

	router := newImageProxyTestRouter(NewImageProxyHandler(upstream.Client(), []string{upstreamURL.Hostname()}, time.Second, 1024, 120, nil))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/assets/img?url="+url.QueryEscape(upstream.URL+"/photo.jpg"), nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d, body=%s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "image/jpeg") {
		t.Fatalf("expected image/jpeg content type, got %q", contentType)
	}
	if cacheControl := recorder.Header().Get("Cache-Control"); cacheControl != "public, max-age=120" {
		t.Fatalf("expected cache-control public, max-age=120, got %q", cacheControl)
	}
	if body := recorder.Body.String(); body != "image-binary" {
		t.Fatalf("expected image payload, got %q", body)
	}
}

func TestImageProxyHandleUpstreamBadStatus(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	}))
	defer upstream.Close()

	upstreamURL, err := url.Parse(upstream.URL)
	if err != nil {
		t.Fatalf("parse upstream url: %v", err)
	}

	router := newImageProxyTestRouter(NewImageProxyHandler(upstream.Client(), []string{upstreamURL.Hostname()}, time.Second, 1024, 120, nil))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/assets/img?url="+url.QueryEscape(upstream.URL+"/missing.jpg"), nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("expected status %d, got %d", http.StatusBadGateway, recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "\"code\":\"upstream_bad_status\"") {
		t.Fatalf("expected upstream_bad_status error, got %s", recorder.Body.String())
	}
}

func TestImageProxyHandleTooLarge(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte("too-large-payload"))
	}))
	defer upstream.Close()

	upstreamURL, err := url.Parse(upstream.URL)
	if err != nil {
		t.Fatalf("parse upstream url: %v", err)
	}

	router := newImageProxyTestRouter(NewImageProxyHandler(upstream.Client(), []string{upstreamURL.Hostname()}, time.Second, 4, 120, nil))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/assets/img?url="+url.QueryEscape(upstream.URL+"/large.png"), nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected status %d, got %d", http.StatusRequestEntityTooLarge, recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "\"code\":\"image_too_large\"") {
		t.Fatalf("expected image_too_large error, got %s", recorder.Body.String())
	}
}

func TestImageProxyHandleUpstreamTimeout(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(50 * time.Millisecond)
		w.Header().Set("Content-Type", "image/jpeg")
		_, _ = w.Write([]byte("late-image"))
	}))
	defer upstream.Close()

	upstreamURL, err := url.Parse(upstream.URL)
	if err != nil {
		t.Fatalf("parse upstream url: %v", err)
	}

	router := newImageProxyTestRouter(NewImageProxyHandler(nil, []string{upstreamURL.Hostname()}, 10*time.Millisecond, 1024, 120, nil))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/assets/img?url="+url.QueryEscape(upstream.URL+"/slow.jpg"), nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusGatewayTimeout {
		t.Fatalf("expected status %d, got %d, body=%s", http.StatusGatewayTimeout, recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "\"code\":\"upstream_timeout\"") {
		t.Fatalf("expected upstream_timeout error, got %s", recorder.Body.String())
	}
}

func TestIsRequestContextCanceled(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if !isRequestContextCanceled(ctx) {
		t.Fatalf("expected canceled request context to be treated as canceled")
	}
	if isRequestContextCanceled(context.Background()) {
		t.Fatalf("expected background context to be treated as active")
	}
}

func TestIsTimeoutError(t *testing.T) {
	t.Parallel()

	if !isTimeoutError(context.DeadlineExceeded) {
		t.Fatalf("expected deadline exceeded to be treated as timeout")
	}

	timeoutErr := &timeoutOnlyError{}
	if !isTimeoutError(timeoutErr) {
		t.Fatalf("expected timeout interface error to be treated as timeout")
	}

	if isTimeoutError(errors.New("plain failure")) {
		t.Fatalf("expected plain error to not be treated as timeout")
	}
}

func TestIsHostAllowed(t *testing.T) {
	t.Parallel()

	allowlist := []string{"images.unsplash.com"}
	if !isHostAllowed("images.unsplash.com", allowlist) {
		t.Fatalf("expected direct host to be allowed")
	}
	if !isHostAllowed("cdn.images.unsplash.com", allowlist) {
		t.Fatalf("expected subdomain to be allowed")
	}
	if isHostAllowed("evilunsplash.com", allowlist) {
		t.Fatalf("expected unrelated host to be blocked")
	}
}

func newImageProxyTestRouter(handler *ImageProxyHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/assets/img", handler.Handle)
	return router
}

type timeoutOnlyError struct{}

func (e *timeoutOnlyError) Error() string   { return "timeout" }
func (e *timeoutOnlyError) Timeout() bool   { return true }
func (e *timeoutOnlyError) Temporary() bool { return false }
