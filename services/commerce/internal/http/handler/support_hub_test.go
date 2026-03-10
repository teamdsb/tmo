package handler

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestApplySupportWebSocketAuthorizationUsesQueryToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest("GET", "/ws/support?token=jwt-token", nil)

	applySupportWebSocketAuthorization(context)

	if got := context.Request.Header.Get("Authorization"); got != "Bearer jwt-token" {
		t.Fatalf("expected Authorization header to be set, got %q", got)
	}
}

func TestApplySupportWebSocketAuthorizationKeepsExistingHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest("GET", "/ws/support?token=jwt-token", nil)
	context.Request.Header.Set("Authorization", "Bearer existing-token")

	applySupportWebSocketAuthorization(context)

	if got := context.Request.Header.Get("Authorization"); got != "Bearer existing-token" {
		t.Fatalf("expected existing Authorization header to be preserved, got %q", got)
	}
}
