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
			port: "18080",
			want: ":18080",
		},
		{
			name:        "service override",
			serviceAddr: ":19080",
			want:        ":19080",
		},
		{
			name:        "service overrides port",
			serviceAddr: ":19080",
			port:        "18080",
			want:        ":19080",
		},
	}

	for _, tc := range testCases {
		test.Run(tc.name, func(test *testing.T) {
			test.Setenv("GATEWAY_HTTP_ADDR", tc.serviceAddr)
			test.Setenv("PORT", tc.port)

			loaded := Load()
			if loaded.HTTPAddr != tc.want {
				test.Fatalf("expected HTTP addr %q, got %q", tc.want, loaded.HTTPAddr)
			}
		})
	}
}
