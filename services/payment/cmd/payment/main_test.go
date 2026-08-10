package main

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"testing"

	"github.com/teamdsb/tmo/services/payment/internal/config"
)

func TestRunRejectsAuthenticationWithoutJWTSecretBeforeStartup(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	err := run(context.Background(), config.Config{AuthEnabled: true}, logger)
	if err == nil || !strings.Contains(err.Error(), "PAYMENT_JWT_SECRET") {
		t.Fatalf("expected fail-closed JWT configuration error, got %v", err)
	}
}
