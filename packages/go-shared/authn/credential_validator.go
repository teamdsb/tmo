package authn

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const DefaultCredentialValidationTimeout = 3 * time.Second

var (
	ErrInvalidCredential     = errors.New("invalid credential")
	ErrValidationUnavailable = errors.New("credential validation unavailable")
)

// CredentialValidator checks whether a locally valid bearer token is still
// active at the identity service. This is what makes password resets, account
// suspension, and role changes revoke already-issued tokens in downstream
// services.
type CredentialValidator interface {
	Validate(ctx context.Context, authorization string) error
}

type IdentityCredentialValidator struct {
	endpoint string
	client   *http.Client
}

func NewIdentityCredentialValidator(baseURL string, client *http.Client) *IdentityCredentialValidator {
	if client == nil {
		client = &http.Client{Timeout: DefaultCredentialValidationTimeout}
	}
	return &IdentityCredentialValidator{
		endpoint: strings.TrimRight(strings.TrimSpace(baseURL), "/") + "/me",
		client:   client,
	}
}

func (v *IdentityCredentialValidator) Validate(ctx context.Context, authorization string) error {
	if v == nil || strings.TrimSpace(v.endpoint) == "/me" || v.client == nil {
		return ErrValidationUnavailable
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.endpoint, nil)
	if err != nil {
		return fmt.Errorf("%w: build identity request: %v", ErrValidationUnavailable, err)
	}
	req.Header.Set("Authorization", strings.TrimSpace(authorization))

	resp, err := v.client.Do(req)
	if err != nil {
		return fmt.Errorf("%w: identity request: %v", ErrValidationUnavailable, err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))

	switch {
	case resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices:
		return nil
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return ErrInvalidCredential
	default:
		return fmt.Errorf("%w: identity returned %s", ErrValidationUnavailable, resp.Status)
	}
}
