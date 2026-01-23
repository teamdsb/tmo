package errors

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	requestIDHeader = "X-Request-ID"
	requestIDKey    = "request_id"
)

type APIError struct {
	Code      string                 `json:"code"`
	Message   string                 `json:"message"`
	RequestId string                 `json:"requestId"`
	Details   map[string]interface{} `json:"details,omitempty"`
}

func Write(c *gin.Context, status int, err APIError) {
	if err.RequestId == "" {
		err.RequestId = requestIDFromContext(c)
	}
	if err.RequestId == "" {
		err.RequestId = uuid.NewString()
		if c != nil {
			c.Writer.Header().Set(requestIDHeader, err.RequestId)
		}
	}
	c.AbortWithStatusJSON(status, err)
}

func requestIDFromContext(c *gin.Context) string {
	if c == nil {
		return ""
	}
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
