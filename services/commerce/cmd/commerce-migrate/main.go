package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

const defaultDSN = "postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable"

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	dsn := os.Getenv("COMMERCE_DB_DSN")
	if dsn == "" {
		dsn = defaultDSN
	}

	migrationsDir, err := resolveMigrationsDir()
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return fmt.Errorf("connect to database: %w", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping database: %w", err)
	}

	if err := db.ApplyMigrations(ctx, pool, migrationsDir); err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}

	fmt.Printf("migrations applied from %s\n", migrationsDir)
	return nil
}

func resolveMigrationsDir() (string, error) {
	if value := os.Getenv("COMMERCE_MIGRATIONS_DIR"); value != "" {
		return value, nil
	}

	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("resolve working dir: %w", err)
	}

	candidates := []string{
		filepath.Join(cwd, "migrations"),
		filepath.Join(cwd, "services", "commerce", "migrations"),
		filepath.Join(cwd, "..", "migrations"),
	}

	for _, dir := range candidates {
		if hasSQL(dir) {
			return dir, nil
		}
	}

	return "", fmt.Errorf("migrations directory not found; set COMMERCE_MIGRATIONS_DIR")
}

func hasSQL(dir string) bool {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if strings.HasSuffix(entry.Name(), ".sql") {
			return true
		}
	}
	return false
}
