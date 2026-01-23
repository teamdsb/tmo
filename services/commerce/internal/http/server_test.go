package http

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/teamdsb/tmo/services/commerce/internal/http/handler"
)

func TestNewRouterRegistersRoutes(test *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiHandler := &handler.Handler{}

	router := NewRouter(apiHandler, logger, func(ctx context.Context) error {
		return nil
	})

	if router == nil {
		test.Fatal("expected router to be created")
	}

	routes := router.Routes()
	if !hasRoute(routes, http.MethodGet, "/health") {
		test.Fatalf("expected /health route to be registered")
	}
	if !hasRoute(routes, http.MethodGet, "/ready") {
		test.Fatalf("expected /ready route to be registered")
	}
	if !hasRoute(routes, http.MethodGet, "/cart") {
		test.Fatalf("expected /cart route to be registered")
	}
}

func TestNewServer(test *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiHandler := &handler.Handler{}

	router := NewRouter(apiHandler, logger, func(ctx context.Context) error {
		return nil
	})

	server := NewServer(":9090", router)
	if server.Addr != ":9090" {
		test.Fatalf("expected server address to be :9090, got %q", server.Addr)
	}
	if server.Handler == nil {
		test.Fatal("expected server handler to be set")
	}
}

func hasRoute(routes []gin.RouteInfo, method, path string) bool {
	for _, routeInfo := range routes {
		if routeInfo.Method == method && routeInfo.Path == path {
			return true
		}
	}
	return false
}
