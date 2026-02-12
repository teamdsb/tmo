package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/teamdsb/tmo/services/commerce/internal/config"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	httpserver "github.com/teamdsb/tmo/services/commerce/internal/http"
	"github.com/teamdsb/tmo/services/commerce/internal/http/handler"
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"

	"github.com/teamdsb/tmo/packages/go-shared/observability"
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
	ctx, stop := signal.NotifyContext(ctx, syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	otelShutdown, err := observability.Setup(ctx, observability.Config{
		ServiceName: "commerce",
	}, logger)
	if err != nil {
		return fmt.Errorf("otel setup failed: %w", err)
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := otelShutdown(shutdownCtx); err != nil {
			logger.Error("otel shutdown failed", "error", err)
		}
	}()

	pool, err := db.NewPool(ctx, cfg.DBDSN)
	if err != nil {
		return fmt.Errorf("database connection failed: %w", err)
	}
	defer pool.Close()

	store := db.New(pool)
	auth := middleware.NewAuthenticator(cfg.AuthEnabled, cfg.JWTSecret, cfg.JWTIssuer)
	apiHandler := &handler.Handler{
		AddressStore:        store,
		CatalogStore:        store,
		CartStore:           store,
		OrderStore:          store,
		TrackingStore:       store,
		WishlistStore:       store,
		ProductRequestStore: store,
		AfterSalesStore:     store,
		InquiryStore:        store,
		MediaLocalOutputDir: cfg.MediaLocalOutputDir,
		MediaPublicBaseURL:  cfg.MediaPublicBaseURL,
		DB:                  pool,
		Auth:                auth,
		Logger:              logger,
	}

	router := httpserver.NewRouter(apiHandler, logger, func(checkCtx context.Context) error {
		return db.Ready(checkCtx, pool)
	})
	server := httpserver.NewServer(cfg.HTTPAddr, router)

	logger.Info("commerce service listening", "addr", cfg.HTTPAddr)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("server stopped: %w", err)
		}
		return nil
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("server shutdown failed: %w", err)
	}

	if err := <-errCh; err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("server stopped: %w", err)
	}

	return nil
}
