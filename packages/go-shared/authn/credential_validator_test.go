package authn

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestIdentityCredentialValidatorStatusMapping(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		status     int
		wantErr    error
		wantHeader string
	}{
		{name: "active", status: http.StatusOK, wantHeader: "Bearer token-1"},
		{name: "revoked", status: http.StatusUnauthorized, wantErr: ErrInvalidCredential, wantHeader: "Bearer token-1"},
		{name: "identity failure", status: http.StatusInternalServerError, wantErr: ErrValidationUnavailable, wantHeader: "Bearer token-1"},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				if r.URL.Path != "/me" {
					t.Errorf("path = %q, want /me", r.URL.Path)
				}
				if got := r.Header.Get("Authorization"); got != test.wantHeader {
					t.Errorf("Authorization = %q, want %q", got, test.wantHeader)
				}
				return &http.Response{
					StatusCode: test.status,
					Status:     http.StatusText(test.status),
					Header:     make(http.Header),
					Body:       io.NopCloser(strings.NewReader("")),
					Request:    r,
				}, nil
			})}

			validator := NewIdentityCredentialValidator("https://identity.example", client)
			err := validator.Validate(context.Background(), "Bearer token-1")
			if test.wantErr == nil && err != nil {
				t.Fatalf("Validate() error = %v", err)
			}
			if test.wantErr != nil && !errors.Is(err, test.wantErr) {
				t.Fatalf("Validate() error = %v, want %v", err, test.wantErr)
			}
		})
	}
}

func TestIdentityCredentialValidatorHasBoundedDefaultClient(t *testing.T) {
	t.Parallel()

	validator := NewIdentityCredentialValidator("http://identity:8081", nil)
	if validator.client.Timeout != DefaultCredentialValidationTimeout {
		t.Fatalf("client timeout = %v, want %v", validator.client.Timeout, DefaultCredentialValidationTimeout)
	}
}

func TestIdentityCredentialValidatorHonorsContextDeadline(t *testing.T) {
	t.Parallel()

	client := &http.Client{
		Timeout: time.Second,
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			<-req.Context().Done()
			return nil, req.Context().Err()
		}),
	}
	validator := NewIdentityCredentialValidator("https://identity.example", client)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	err := validator.Validate(ctx, "Bearer token-1")
	if !errors.Is(err, ErrValidationUnavailable) {
		t.Fatalf("Validate() error = %v, want unavailable", err)
	}
}
