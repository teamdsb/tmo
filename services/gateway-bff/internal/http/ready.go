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
	PaymentBaseURL  string
	AIBaseURL       string
	Client          *http.Client
}

func NewReadyChecker(identityBaseURL, commerceBaseURL, paymentBaseURL, aiBaseURL string, timeout time.Duration) *ReadyChecker {
	clientTimeout := timeout
	if clientTimeout <= 0 {
		clientTimeout = 2 * time.Second
	}
	return &ReadyChecker{
		IdentityBaseURL: identityBaseURL,
		CommerceBaseURL: commerceBaseURL,
		PaymentBaseURL:  paymentBaseURL,
		AIBaseURL:       aiBaseURL,
		Client: &http.Client{
			Timeout: clientTimeout,
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
	if err := c.checkOptionalURL(ctx, c.PaymentBaseURL); err != nil {
		return fmt.Errorf("payment not ready: %w", err)
	}
	if err := c.checkOptionalURL(ctx, c.AIBaseURL); err != nil {
		return fmt.Errorf("ai not ready: %w", err)
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

func (c *ReadyChecker) checkOptionalURL(ctx context.Context, baseURL string) error {
	trimmed := strings.TrimSpace(baseURL)
	if trimmed == "" {
		return nil
	}
	return c.checkURL(ctx, trimmed)
}
