package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"

	"github.com/gin-gonic/gin"
)

func decodeJSONFields(c *gin.Context, out interface{}) (map[string]json.RawMessage, error) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, err
	}
	if len(bytes.TrimSpace(body)) == 0 {
		return nil, errors.New("empty body")
	}
	if err := json.Unmarshal(body, out); err != nil {
		return nil, err
	}
	fields := make(map[string]json.RawMessage)
	if err := json.Unmarshal(body, &fields); err != nil {
		return nil, err
	}
	return fields, nil
}

func hasJSONField(fields map[string]json.RawMessage, name string) bool {
	_, ok := fields[name]
	return ok
}
