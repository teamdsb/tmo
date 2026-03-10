package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
)

type supportHubEnvelope struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type supportHubClient struct {
	conn    *websocket.Conn
	claims  middleware.Claims
	isStaff bool
	send    chan []byte
}

type SupportHub struct {
	upgrader websocket.Upgrader
	mu       sync.RWMutex
	clients  map[*supportHubClient]struct{}
}

func NewSupportHub() *SupportHub {
	return &SupportHub{
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
		clients: make(map[*supportHubClient]struct{}),
	}
}

func (h *SupportHub) ServeWS(c *gin.Context, claims middleware.Claims) {
	if h == nil {
		c.Status(http.StatusServiceUnavailable)
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := &supportHubClient{
		conn:    conn,
		claims:  claims,
		isStaff: !isCustomerRole(claims.Role),
		send:    make(chan []byte, 32),
	}

	h.mu.Lock()
	h.clients[client] = struct{}{}
	h.mu.Unlock()

	go h.writePump(client)
	h.readPump(client)
}

func (h *SupportHub) readPump(client *supportHubClient) {
	defer h.unregister(client)
	client.conn.SetReadLimit(1 << 20)
	_ = client.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	client.conn.SetPongHandler(func(string) error {
		return client.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	for {
		if _, _, err := client.conn.ReadMessage(); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				return
			}
			return
		}
	}
}

func (h *SupportHub) writePump(client *supportHubClient) {
	ticker := time.NewTicker(25 * time.Second)
	defer func() {
		ticker.Stop()
		_ = client.conn.Close()
	}()

	for {
		select {
		case message, ok := <-client.send:
			_ = client.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = client.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := client.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			_ = client.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := client.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (h *SupportHub) unregister(client *supportHubClient) {
	h.mu.Lock()
	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.send)
	}
	h.mu.Unlock()
	_ = client.conn.Close()
}

func (h *SupportHub) PublishConversation(eventType string, conversation db.SupportConversation, data interface{}) {
	if h == nil {
		return
	}

	payload, err := json.Marshal(supportHubEnvelope{
		Type: eventType,
		Data: data,
	})
	if err != nil {
		return
	}

	h.mu.RLock()
	clients := make([]*supportHubClient, 0, len(h.clients))
	for client := range h.clients {
		clients = append(clients, client)
	}
	h.mu.RUnlock()

	for _, client := range clients {
		if !supportHubClientCanAccessConversation(client, conversation) {
			continue
		}
		select {
		case client.send <- payload:
		default:
			h.unregister(client)
		}
	}
}

func supportHubClientCanAccessConversation(client *supportHubClient, conversation db.SupportConversation) bool {
	if client == nil {
		return false
	}
	return canAccessSupportConversation(client.claims.Role, client.claims.UserID, conversation)
}

func (h *Handler) GetSupportWebSocket(c *gin.Context) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}
	if h.SupportHub == nil {
		h.writeError(c, http.StatusServiceUnavailable, "service_unavailable", "support websocket is unavailable")
		return
	}
	h.SupportHub.ServeWS(c, claims)
}

func publishSupportEvent(hub *SupportHub, eventType string, conversation db.SupportConversation, data interface{}) {
	if hub == nil {
		return
	}
	hub.PublishConversation(eventType, conversation, data)
}

func isBrokenPipe(err error) bool {
	return errors.Is(err, context.Canceled)
}
