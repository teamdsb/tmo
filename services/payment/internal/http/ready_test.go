package http

import (
	"context"
	stdhttp "net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestReadyCheckerCheck(test *testing.T) {
	test.Run("success", func(test *testing.T) {
		server := httptest.NewServer(stdhttp.HandlerFunc(func(writer stdhttp.ResponseWriter, request *stdhttp.Request) {
			if request.URL.Path != "/ready" {
				test.Fatalf("expected /ready path, got %s", request.URL.Path)
			}
			writer.WriteHeader(stdhttp.StatusOK)
		}))
		defer server.Close()

		checker := NewReadyChecker(server.URL, time.Second)
		if err := checker.Check(context.Background()); err != nil {
			test.Fatalf("expected no error, got %v", err)
		}
	})

	test.Run("missing identity base url", func(test *testing.T) {
		checker := NewReadyChecker("  ", time.Second)
		if err := checker.Check(context.Background()); err == nil {
			test.Fatalf("expected error for missing identity base url")
		}
	})

	test.Run("identity not ready", func(test *testing.T) {
		server := httptest.NewServer(stdhttp.HandlerFunc(func(writer stdhttp.ResponseWriter, request *stdhttp.Request) {
			writer.WriteHeader(stdhttp.StatusServiceUnavailable)
		}))
		defer server.Close()

		checker := NewReadyChecker(server.URL, time.Second)
		if err := checker.Check(context.Background()); err == nil {
			test.Fatalf("expected error when identity is not ready")
		}
	})
}
