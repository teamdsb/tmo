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
			port: "18083",
			want: ":18083",
		},
		{
			name:        "service override",
			serviceAddr: ":19083",
			want:        ":19083",
		},
		{
			name:        "service overrides port",
			serviceAddr: ":19083",
			port:        "18083",
			want:        ":19083",
		},
	}

	for _, tc := range testCases {
		test.Run(tc.name, func(test *testing.T) {
			test.Setenv("PAYMENT_HTTP_ADDR", tc.serviceAddr)
			test.Setenv("PORT", tc.port)

			loaded := Load()
			if loaded.HTTPAddr != tc.want {
				test.Fatalf("expected HTTP addr %q, got %q", tc.want, loaded.HTTPAddr)
			}
		})
	}
}
