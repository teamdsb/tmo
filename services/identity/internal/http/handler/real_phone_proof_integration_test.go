package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/teamdsb/tmo/services/identity/internal/platform"
)

func TestMiniLoginRejectsInvalidPhoneProofAfterVerifiedSession(t *testing.T) {
	var sessionCalls, phoneCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var response any
		switch r.URL.Path {
		case "/session":
			sessionCalls.Add(1)
			response = map[string]any{"openid": "verified-phone-proof-test", "session_key": "test-session"}
		case "/token":
			response = map[string]any{"access_token": "test-token", "expires_in": 7200}
		case "/phone":
			phoneCalls.Add(1)
			response = map[string]any{"errcode": 40029, "errmsg": "invalid phone code"}
		default:
			http.NotFound(w, r)
			return
		}
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Error(err)
		}
	}))
	defer upstream.Close()

	router, pool := setupTestRouterWithPlatformConfig(t, platform.Config{
		Mode: platform.LoginModeReal, WeappAppID: "test-app", WeappAppSecret: "test-secret",
		WeappSessionURL: upstream.URL + "/session", WeappTokenURL: upstream.URL + "/token",
		WeappPhoneURL: upstream.URL + "/phone", HTTPClient: upstream.Client(),
	})
	if err := resetIdentityTables(context.Background(), pool); err != nil {
		t.Fatal(err)
	}
	response := doJSON(t, router, http.MethodPost, "/auth/mini/login", map[string]any{
		"platform": "weapp", "code": "verified-session-code",
		"phoneProof": map[string]any{"code": "invalid-phone-code"},
	}, "")
	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected rejected phone proof: %d %s", response.Code, response.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["code"] != "invalid_phone_proof" || body["accessToken"] != nil {
		t.Fatalf("unexpected rejection: %v", body)
	}
	if sessionCalls.Load() != 1 || phoneCalls.Load() != 1 {
		t.Fatal("the test must reach phone verification after a successful platform session")
	}
	var identities int
	if err := pool.QueryRow(context.Background(), "SELECT count(*) FROM user_identities WHERE provider_user_id=$1", "verified-phone-proof-test").Scan(&identities); err != nil {
		t.Fatal(err)
	}
	if identities != 0 {
		t.Fatal("rejected phone proof created a platform identity")
	}
}
