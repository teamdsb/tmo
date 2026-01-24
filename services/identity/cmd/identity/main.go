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
	"github.com/teamdsb/tmo/services/identity/internal/auth"
	"github.com/teamdsb/tmo/services/identity/internal/config"
	"github.com/teamdsb/tmo/services/identity/internal/db"
	httpserver "github.com/teamdsb/tmo/services/identity/internal/http"
	"github.com/teamdsb/tmo/services/identity/internal/http/handler"
	"github.com/teamdsb/tmo/services/identity/internal/platform"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLogLevel(cfg.LogLevel),
	}))

	if err := run(context.Background(), cfg, logger); err != nil {
		logger.Error("identity service stopped", "error", err)
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
		ServiceName: "identity",
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

	authManager := auth.NewTokenManager(cfg.JWTSecret, cfg.JWTIssuer, cfg.AccessTokenTTL)
	store := db.New(pool)
	platformResolver := platform.NewMiniLoginResolver(platform.Config{
		Mode:             platform.LoginMode(cfg.LoginMode),
		WeappAppID:       cfg.WeappAppID,
		WeappAppSecret:   cfg.WeappAppSecret,
		WeappSessionURL:  cfg.WeappSessionURL,
		WeappTokenURL:    cfg.WeappTokenURL,
		WeappQRCodeURL:   cfg.WeappQRCodeURL,
		WeappSalesPage:   cfg.WeappSalesPage,
		WeappQRWidth:     cfg.WeappQRWidth,
		AlipayAppID:      cfg.AlipayAppID,
		AlipayPrivateKey: cfg.AlipayPrivateKey,
		AlipayPublicKey:  cfg.AlipayPublicKey,
		AlipayGatewayURL: cfg.AlipayGatewayURL,
		AlipaySignType:   cfg.AlipaySignType,
		AlipaySalesPage:  cfg.AlipaySalesPage,
	})

	apiHandler := &handler.Handler{
		DB:       pool,
		Logger:   logger,
		Auth:     authManager,
		Store:    store,
		Platform: platformResolver,
	}

	router := httpserver.NewRouter(apiHandler, logger, func(checkCtx context.Context) error {
		return db.Ready(checkCtx, pool)
	})
	server := httpserver.NewServer(cfg.HTTPAddr, router)

	logger.Info("identity service listening", "addr", cfg.HTTPAddr)

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
