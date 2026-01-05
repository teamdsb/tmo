package main

import (
	"context"
	"log"

	"tmo/internal/config"
	"tmo/internal/db"
	"tmo/internal/handlers"
	"tmo/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	pool, err := db.NewPool(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connection error: %v", err)
	}
	defer pool.Close()

	svc := store.NewPostgresStore(pool)
	router := handlers.NewRouter(svc)

	if err := router.Run(cfg.Addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
