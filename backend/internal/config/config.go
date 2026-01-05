package config

import (
	"errors"
	"os"
)

type Config struct {
	Addr        string
	DatabaseURL string
}

func Load() (Config, error) {
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}

	return Config{
		Addr:        addr,
		DatabaseURL: dbURL,
	}, nil
}
