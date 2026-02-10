package http

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestLocalMediaHandlerServeFile(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	mediaPath := filepath.Join(rootDir, "catalog", "demo.txt")
	if err := os.MkdirAll(filepath.Dir(mediaPath), 0o755); err != nil {
		t.Fatalf("mkdir media dir: %v", err)
	}
	if err := os.WriteFile(mediaPath, []byte("demo-media"), 0o644); err != nil {
		t.Fatalf("write media file: %v", err)
	}

	handler := NewLocalMediaHandler(rootDir, 60, nil)
	router := gin.New()
	router.GET("/assets/media/*path", handler.Handle)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/assets/media/catalog/demo.txt", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	if got := recorder.Body.String(); got != "demo-media" {
		t.Fatalf("expected media body %q, got %q", "demo-media", got)
	}
}

func TestIsPathUnderRoot(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	outside := filepath.Clean(filepath.Join(rootDir, "..", "outside.txt"))
	if isPathUnderRoot(outside, rootDir) {
		t.Fatalf("path %q should not be treated as under root %q", outside, rootDir)
	}

	inside := filepath.Join(rootDir, "catalog", "demo.txt")
	if !isPathUnderRoot(inside, rootDir) {
		t.Fatalf("path %q should be treated as under root %q", inside, rootDir)
	}
}

func TestLocalMediaHandlerDisabled(t *testing.T) {
	t.Parallel()

	handler := NewLocalMediaHandler("", 60, nil)
	router := gin.New()
	router.GET("/assets/media/*path", handler.Handle)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/assets/media/catalog/demo.txt", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", recorder.Code)
	}
}
