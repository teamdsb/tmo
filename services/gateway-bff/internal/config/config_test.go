package config

import (
	"reflect"
	"testing"
)

func TestLoadDefaultsImageProxyAllowlist(t *testing.T) {
	t.Setenv("GATEWAY_IMAGE_PROXY_ALLOWLIST", "")

	got := Load().ImageProxyAllowlist
	want := []string{"images.unsplash.com", "lh3.googleusercontent.com"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("expected default image proxy allowlist %v, got %v", want, got)
	}
}
