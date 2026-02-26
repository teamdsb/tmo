package config

import "testing"

func TestLoadHTTPAddrPrecedence(test *testing.T) {
	testCases := []struct {
		name        string
		serviceAddr string
		port        string
		want        string
	}{
		{
			name: "defaults",
			want: defaultHTTPAddr,
		},
		{
			name: "port fallback",
			port: "18081",
			want: ":18081",
		},
		{
			name:        "service override",
			serviceAddr: ":19081",
			want:        ":19081",
		},
		{
			name:        "service overrides port",
			serviceAddr: ":19081",
			port:        "18081",
			want:        ":19081",
		},
	}

	for _, tc := range testCases {
		test.Run(tc.name, func(test *testing.T) {
			test.Setenv("IDENTITY_HTTP_ADDR", tc.serviceAddr)
			test.Setenv("PORT", tc.port)

			loaded := Load()
			if loaded.HTTPAddr != tc.want {
				test.Fatalf("expected HTTP addr %q, got %q", tc.want, loaded.HTTPAddr)
			}
		})
	}
}
