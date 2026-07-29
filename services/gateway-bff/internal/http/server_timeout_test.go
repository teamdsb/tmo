package http

import (
	"net/http"
	"testing"
	"time"
)

func TestGatewayWriteTimeoutUsesImageProxyTimeoutPlusBuffer(t *testing.T) {
	t.Parallel()

	timeout := gatewayWriteTimeout(120 * time.Second)
	want := 125 * time.Second
	if timeout != want {
		t.Fatalf("expected write timeout %s, got %s", want, timeout)
	}
}

func TestGatewayWriteTimeoutKeepsBaseServerMinimum(t *testing.T) {
	t.Parallel()

	timeout := gatewayWriteTimeout(2 * time.Second)
	if timeout != uploadRequestTimeout {
		t.Fatalf("expected minimum write timeout %s, got %s", uploadRequestTimeout, timeout)
	}
}

func TestNewServerUsesGatewayWriteTimeout(t *testing.T) {
	t.Parallel()

	server := NewServer(":8080", http.NewServeMux(), 120*time.Second)
	if server.ReadTimeout != uploadRequestTimeout {
		t.Fatalf("expected read timeout %s, got %s", uploadRequestTimeout, server.ReadTimeout)
	}
	if server.WriteTimeout != 125*time.Second {
		t.Fatalf("expected server write timeout 125s, got %s", server.WriteTimeout)
	}
}
