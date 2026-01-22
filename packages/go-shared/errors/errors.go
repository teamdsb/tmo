package errors

import "github.com/gin-gonic/gin"

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

func Write(c *gin.Context, status int, err APIError) {
	c.AbortWithStatusJSON(status, err)
}
