package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	errSalesAssigneeInvalid = errors.New("sales assignee is invalid")
	errIdentityUnavailable  = errors.New("identity service unavailable")
)

type SalesAssigneeValidator interface {
	ValidateActiveSales(context.Context, string, uuid.UUID) error
}

type IdentityClient struct {
	baseURL string
	client  *http.Client
}

func NewIdentityClient(baseURL string, client *http.Client) *IdentityClient {
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	return &IdentityClient{baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"), client: client}
}

func (c *IdentityClient) ValidateActiveSales(ctx context.Context, authorization string, userID uuid.UUID) error {
	if c == nil || c.baseURL == "" {
		return fmt.Errorf("%w: base URL is not configured", errIdentityUnavailable)
	}
	endpoint, err := url.JoinPath(c.baseURL, "staff", userID.String())
	if err != nil {
		return fmt.Errorf("%w: %v", errIdentityUnavailable, err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return fmt.Errorf("%w: %v", errIdentityUnavailable, err)
	}
	if strings.TrimSpace(authorization) != "" {
		req.Header.Set("Authorization", authorization)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", errIdentityUnavailable, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("%w: user not found", errSalesAssigneeInvalid)
	}
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, resp.Body)
		return fmt.Errorf("%w: identity returned %d", errIdentityUnavailable, resp.StatusCode)
	}
	var staff struct {
		Status string   `json:"status"`
		Roles  []string `json:"roles"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&staff); err != nil {
		return fmt.Errorf("%w: invalid response", errIdentityUnavailable)
	}
	if !strings.EqualFold(staff.Status, "active") {
		return fmt.Errorf("%w: user is not active", errSalesAssigneeInvalid)
	}
	for _, role := range staff.Roles {
		if strings.EqualFold(role, "SALES") {
			return nil
		}
	}
	return fmt.Errorf("%w: user does not have SALES role", errSalesAssigneeInvalid)
}
