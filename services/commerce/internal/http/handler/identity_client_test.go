package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

func TestIdentityClientValidateActiveSales(t *testing.T) {
	userID := uuid.New()
	tests := []struct {
		name, body string
		status     int
		want       error
	}{
		{name: "active sales", status: http.StatusOK, body: `{"status":"active","roles":["CUSTOMER","SALES"]}`},
		{name: "disabled sales", status: http.StatusOK, body: `{"status":"disabled","roles":["SALES"]}`, want: errSalesAssigneeInvalid},
		{name: "non sales", status: http.StatusOK, body: `{"status":"active","roles":["CS"]}`, want: errSalesAssigneeInvalid},
		{name: "missing", status: http.StatusNotFound, body: `{}`, want: errSalesAssigneeInvalid},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/staff/"+userID.String() {
					t.Errorf("unexpected path %s", r.URL.Path)
				}
				if r.Header.Get("Authorization") != "Bearer token" {
					t.Errorf("authorization not forwarded")
				}
				w.WriteHeader(test.status)
				_, _ = w.Write([]byte(test.body))
			}))
			defer server.Close()
			err := NewIdentityClient(server.URL, server.Client()).ValidateActiveSales(context.Background(), "Bearer token", userID)
			if test.want == nil && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if test.want != nil && !errors.Is(err, test.want) {
				t.Fatalf("got %v, want %v", err, test.want)
			}
		})
	}
}
