package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

func String(key, fallback string) string {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}
	return value
}

// ListenAddr resolves service listen address with precedence:
// 1) service-specific key (for example COMMERCE_HTTP_ADDR)
// 2) generic PORT (as commonly injected by PaaS platforms)
// 3) fallback default.
func ListenAddr(primaryKey, fallback string) string {
	primary := strings.TrimSpace(os.Getenv(primaryKey))
	if primary != "" {
		return primary
	}

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		return fallback
	}

	if strings.HasPrefix(port, ":") || strings.Contains(port, ":") {
		return port
	}

	return ":" + port
}

func Int(key string, fallback int) int {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func Bool(key string, fallback bool) bool {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func Duration(key string, fallback time.Duration) time.Duration {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}
