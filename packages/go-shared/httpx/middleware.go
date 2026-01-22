package httpx

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
)

const (
	requestIDHeader = "X-Request-ID"
	requestIDKey    = "request_id"
)

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader(requestIDHeader)
		if requestID == "" {
			requestID = uuid.NewString()
		}
		c.Set(requestIDKey, requestID)
		c.Writer.Header().Set(requestIDHeader, requestID)
		c.Next()
	}
}

func RequestIDFromContext(c *gin.Context) string {
	if value, ok := c.Get(requestIDKey); ok {
		if requestID, ok := value.(string); ok {
			return requestID
		}
	}
	if requestID := c.Writer.Header().Get(requestIDHeader); requestID != "" {
		return requestID
	}
	return c.GetHeader(requestIDHeader)
}

func AccessLog(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		if logger == nil {
			return
		}

		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		logger.Info("http request",
			"method", c.Request.Method,
			"path", path,
			"status", c.Writer.Status(),
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", RequestIDFromContext(c),
			"client_ip", c.ClientIP(),
			"user_agent", c.Request.UserAgent(),
		)
	}
}

func Recovery(logger *slog.Logger) gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		if logger != nil {
			logger.Error("panic recovered",
				"error", recovered,
				"request_id", RequestIDFromContext(c),
			)
		}
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "internal_error",
			Message: "internal server error",
		})
	})
}

func Health() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.String(http.StatusOK, "OK")
	}
}

func Ready(check func(context.Context) error) gin.HandlerFunc {
	return func(c *gin.Context) {
		if check == nil {
			c.String(http.StatusOK, "OK")
			return
		}

		readyCtx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		if err := check(readyCtx); err != nil {
			apierrors.Write(c, http.StatusServiceUnavailable, apierrors.APIError{
				Code:    "not_ready",
				Message: "dependencies not ready",
			})
			return
		}

		c.String(http.StatusOK, "OK")
	}
}
