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
	"github.com/teamdsb/tmo/services/gateway-bff/internal/config"
	httpserver "github.com/teamdsb/tmo/services/gateway-bff/internal/http"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLogLevel(cfg.LogLevel),
	}))

	if err := run(context.Background(), cfg, logger); err != nil {
		logger.Error("gateway-bff service stopped", "error", err)
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
		ServiceName: "gateway-bff",
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

	proxyHandler, err := httpserver.NewProxyHandler(cfg.IdentityBaseURL, cfg.CommerceBaseURL, cfg.PaymentBaseURL, cfg.AIBaseURL, logger, cfg.UpstreamTimeout)
	if err != nil {
		return fmt.Errorf("init proxy failed: %w", err)
	}
	readyChecker := httpserver.NewReadyChecker(cfg.IdentityBaseURL, cfg.CommerceBaseURL, cfg.PaymentBaseURL, cfg.AIBaseURL, cfg.UpstreamTimeout)
	upstreamClient := &http.Client{
		Timeout: cfg.UpstreamTimeout,
	}
	bootstrapHandler := httpserver.NewBootstrapHandler(cfg.IdentityBaseURL, upstreamClient, logger)
	catalogRewriteHandler, err := httpserver.NewCatalogRewriteHandler(
		cfg.CommerceBaseURL,
		cfg.PublicBaseURL,
		cfg.UpstreamTimeout,
		logger,
	)
	if err != nil {
		return fmt.Errorf("init catalog rewrite failed: %w", err)
	}
	imageProxyHandler := httpserver.NewImageProxyHandler(
		nil,
		cfg.ImageProxyAllowlist,
		cfg.ImageProxyTimeout,
		int64(cfg.ImageProxyMaxBytes),
		cfg.ImageProxyCacheMaxAgeSeconds,
		logger,
	)

	router := httpserver.NewRouter(httpserver.ProxyHandlers{
		Identity:             proxyHandler.Identity,
		Commerce:             proxyHandler.Commerce,
		CatalogProducts:      catalogRewriteHandler.ListProducts,
		CatalogProductDetail: catalogRewriteHandler.GetProductDetail,
		Payment:              proxyHandler.Payment,
		AI:                   proxyHandler.AI,
		Bootstrap:            bootstrapHandler.Handle,
		Image:                imageProxyHandler.Handle,
	}, logger, readyChecker.Check, int64(cfg.MaxBodyBytes))

	server := httpserver.NewServer(cfg.HTTPAddr, router)

	logger.Info("gateway-bff service listening", "addr", cfg.HTTPAddr)

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
