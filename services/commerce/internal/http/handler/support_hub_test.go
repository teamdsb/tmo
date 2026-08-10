package handler

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
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

func TestSupportHubPublishConversationConcurrentDisconnectDoesNotPanic(t *testing.T) {
	for attempt := 0; attempt < 64; attempt++ {
		hub := NewSupportHub()
		client := &supportHubClient{
			claims: middleware.Claims{Role: "ADMIN", UserID: uuid.New()},
			send:   make(chan []byte, 1),
		}
		hub.mu.Lock()
		hub.clients[client] = struct{}{}
		hub.mu.Unlock()

		disconnectDone := make(chan struct{})
		hub.beforeSend = func(current *supportHubClient) {
			// TryLock succeeds only in the pre-fix implementation, where Publish
			// released RLock before reaching the send. In that case, wait for the
			// concurrent disconnect to close the channel and reproduce the panic.
			readLockHeld := true
			if hub.mu.TryLock() {
				readLockHeld = false
				hub.mu.Unlock()
			}

			disconnectStarted := make(chan struct{})
			go func() {
				close(disconnectStarted)
				hub.mu.Lock()
				if _, ok := hub.clients[current]; ok {
					delete(hub.clients, current)
					close(current.send)
				}
				hub.mu.Unlock()
				close(disconnectDone)
			}()
			<-disconnectStarted
			if !readLockHeld {
				<-disconnectDone
			}
		}

		result := make(chan any, 1)
		go func() {
			defer func() {
				result <- recover()
			}()
			hub.PublishConversation("support.message.created", db.SupportConversation{}, map[string]string{"id": "message-1"})
		}()

		select {
		case recovered := <-result:
			if recovered != nil {
				t.Fatalf("attempt %d: publish panicked while client disconnected: %v", attempt, recovered)
			}
		case <-time.After(time.Second):
			t.Fatalf("attempt %d: publish did not complete within one second", attempt)
		}
		select {
		case <-disconnectDone:
		case <-time.After(time.Second):
			t.Fatalf("attempt %d: disconnect did not complete within one second", attempt)
		}
	}
}
