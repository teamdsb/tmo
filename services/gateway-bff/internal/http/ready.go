package http

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type ReadyChecker struct {
	IdentityBaseURL string
	CommerceBaseURL string
	Client          *http.Client
}

func NewReadyChecker(identityBaseURL, commerceBaseURL string) *ReadyChecker {
	return &ReadyChecker{
		IdentityBaseURL: identityBaseURL,
		CommerceBaseURL: commerceBaseURL,
		Client: &http.Client{
			Timeout: 2 * time.Second,
		},
	}
}

func (c *ReadyChecker) Check(ctx context.Context) error {
	if err := c.checkURL(ctx, c.IdentityBaseURL); err != nil {
		return fmt.Errorf("identity not ready: %w", err)
	}
	if err := c.checkURL(ctx, c.CommerceBaseURL); err != nil {
		return fmt.Errorf("commerce not ready: %w", err)
	}
	return nil
}

func (c *ReadyChecker) checkURL(ctx context.Context, baseURL string) error {
	trimmed := strings.TrimSpace(baseURL)
	if trimmed == "" {
		return fmt.Errorf("base url missing")
	}
	target := strings.TrimRight(trimmed, "/") + "/ready"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return err
	}
	client := c.Client
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return nil
}
