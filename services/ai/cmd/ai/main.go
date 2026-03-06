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
	"github.com/teamdsb/tmo/services/ai/internal/commerce"
	"github.com/teamdsb/tmo/services/ai/internal/config"
	httpserver "github.com/teamdsb/tmo/services/ai/internal/http"
	"github.com/teamdsb/tmo/services/ai/internal/http/handler"
	"github.com/teamdsb/tmo/services/ai/internal/http/middleware"
	"github.com/teamdsb/tmo/services/ai/internal/knowledge"
	"github.com/teamdsb/tmo/services/ai/internal/provider"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLogLevel(cfg.LogLevel),
	}))

	if err := run(context.Background(), cfg, logger); err != nil {
		logger.Error("ai service stopped", "error", err)
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
		ServiceName: "ai",
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
	commerceClient := commerce.NewClient(cfg.CommerceBaseURL, cfg.RequestTimeout)
	knowledgeBase, err := knowledge.NewBase(commerceClient, logger, cfg.KnowledgeRefreshInterval)
	if err != nil {
		return fmt.Errorf("knowledge base init failed: %w", err)
	}
	knowledgeBase.Start(ctx)

	suggestionProvider, err := provider.New(cfg.Provider, provider.Config{
		BaseURL: cfg.ProviderBaseURL,
		APIKey:  cfg.ProviderAPIKey,
		Model:   cfg.ProviderModel,
	})
	if err != nil {
		return fmt.Errorf("provider init failed: %w", err)
	}

	apiHandler := &handler.Handler{
		Logger:      logger,
		Auth:        auth,
		Commerce:    commerceClient,
		Knowledge:   knowledgeBase,
		Suggestions: suggestionProvider,
	}

	router := httpserver.NewRouter(apiHandler, logger, nil)
	server := httpserver.NewServer(cfg.HTTPAddr, router)

	logger.Info("ai service listening", "addr", cfg.HTTPAddr)

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
