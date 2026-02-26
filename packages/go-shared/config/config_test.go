package config

import "testing"

func TestListenAddrPrecedence(test *testing.T) {
	testCases := []struct {
		name        string
		serviceAddr string
		port        string
		want        string
	}{
		{
			name: "fallback",
			want: ":8080",
		},
		{
			name: "port numeric",
			port: "18080",
			want: ":18080",
		},
		{
			name: "port with colon",
			port: ":18080",
			want: ":18080",
		},
		{
			name: "port host and port",
			port: "0.0.0.0:18080",
			want: "0.0.0.0:18080",
		},
		{
			name:        "service addr overrides port",
			serviceAddr: ":19080",
			port:        "18080",
			want:        ":19080",
		},
	}

	for _, tc := range testCases {
		test.Run(tc.name, func(test *testing.T) {
			test.Setenv("SERVICE_HTTP_ADDR", tc.serviceAddr)
			test.Setenv("PORT", tc.port)

			got := ListenAddr("SERVICE_HTTP_ADDR", ":8080")
			if got != tc.want {
				test.Fatalf("expected %q, got %q", tc.want, got)
			}
		})
	}
}
