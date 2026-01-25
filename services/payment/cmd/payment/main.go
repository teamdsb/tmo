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

	"github.com/teamdsb/tmo/packages/go-shared/observability"
	"github.com/teamdsb/tmo/services/payment/internal/config"
	httpserver "github.com/teamdsb/tmo/services/payment/internal/http"
	"github.com/teamdsb/tmo/services/payment/internal/http/handler"
	"github.com/teamdsb/tmo/services/payment/internal/http/middleware"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLogLevel(cfg.LogLevel),
	}))

	if err := run(context.Background(), cfg, logger); err != nil {
		logger.Error("payment service stopped", "error", err)
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
		ServiceName: "payment",
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

	auth := middleware.NewAuthenticator(cfg.AuthEnabled, cfg.JWTSecret, cfg.JWTIssuer)
	flagsProvider := handler.NewIdentityFlagsProvider(cfg.IdentityBaseURL, cfg.FeatureFlagsTimeout, handler.FeatureFlags{
		PaymentEnabled:   cfg.PaymentEnabled,
		WechatPayEnabled: cfg.WechatPayEnabled,
		AlipayPayEnabled: cfg.AlipayPayEnabled,
	}, logger)

	apiHandler := &handler.Handler{
		Logger: logger,
		Auth:   auth,
		Flags:  flagsProvider,
	}

	router := httpserver.NewRouter(apiHandler, logger, nil)
	server := httpserver.NewServer(cfg.HTTPAddr, router)

	logger.Info("payment service listening", "addr", cfg.HTTPAddr)

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
