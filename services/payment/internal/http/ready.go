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
	Client          *http.Client
}

func NewReadyChecker(identityBaseURL string, timeout time.Duration) *ReadyChecker {
	clientTimeout := timeout
	if clientTimeout <= 0 {
		clientTimeout = 2 * time.Second
	}
	return &ReadyChecker{
		IdentityBaseURL: identityBaseURL,
		Client: &http.Client{
			Timeout: clientTimeout,
		},
	}
}

func (checker *ReadyChecker) Check(ctx context.Context) error {
	trimmed := strings.TrimSpace(checker.IdentityBaseURL)
	if trimmed == "" {
		return fmt.Errorf("identity base url missing")
	}

	target := strings.TrimRight(trimmed, "/") + "/ready"
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return err
	}

	client := checker.Client
	if client == nil {
		client = http.DefaultClient
	}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("identity status %d", response.StatusCode)
	}

	return nil
}
