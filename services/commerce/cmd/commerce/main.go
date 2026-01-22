package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/teamdsb/tmo/services/commerce/internal/config"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	httpserver "github.com/teamdsb/tmo/services/commerce/internal/http"
	"github.com/teamdsb/tmo/services/commerce/internal/http/handler"
<<<<<<< Updated upstream
=======
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"

	"github.com/teamdsb/tmo/packages/go-shared/observability"
>>>>>>> Stashed changes
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLogLevel(cfg.LogLevel),
	}))

	if err := run(context.Background(), cfg, logger); err != nil {
		logger.Error("commerce service stopped", "error", err)
		os.Exit(1)
	}
}

func parseLogLevel(raw string) slog.Level {
	switch strings.ToLower(raw) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func run(ctx context.Context, cfg config.Config, logger *slog.Logger) error {
	pool, err := db.NewPool(ctx, cfg.DBDSN)
	if err != nil {
		return fmt.Errorf("database connection failed: %w", err)
	}
	defer pool.Close()

	store := db.New(pool)
	auth := middleware.NewAuthenticator(cfg.AuthEnabled, cfg.JWTSecret, cfg.JWTIssuer)
	apiHandler := &handler.Handler{
		CatalogStore:  store,
		CartStore:     store,
		OrderStore:    store,
		TrackingStore: store,
		Auth:          auth,
		Logger:        logger,
	}

	router := httpserver.NewRouter(apiHandler)
	server := httpserver.NewServer(cfg.HTTPAddr, router)

	logger.Info("commerce service listening", "addr", cfg.HTTPAddr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("server stopped: %w", err)
	}

	return nil
}
