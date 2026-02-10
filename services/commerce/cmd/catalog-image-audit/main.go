package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultDSN = "postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable"

type domainCount struct {
	Host  string
	Count int
}

type auditStats struct {
	TotalProducts        int
	ProductsWithoutImage int
	TotalRefs            int
	ProxyRefs            int
	ManagedRefs          int
	ExternalRefs         int
	LocalRefs            int
	InvalidRefs          int
	PlaceholderRefs      int
	DomainCounts         map[string]int
}

type productRow struct {
	ID            uuid.UUID
	CoverImageURL *string
	Images        []string
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	dsn := strings.TrimSpace(os.Getenv("COMMERCE_DB_DSN"))
	if dsn == "" {
		dsn = defaultDSN
	}

	timeout := 30 * time.Second
	if raw := strings.TrimSpace(os.Getenv("CATALOG_IMAGE_AUDIT_TIMEOUT")); raw != "" {
		if parsed, err := time.ParseDuration(raw); err == nil && parsed > 0 {
			timeout = parsed
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return fmt.Errorf("connect to database: %w", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping database: %w", err)
	}

	rows, err := pool.Query(ctx, `
SELECT id, cover_image_url, images
FROM catalog_products
ORDER BY created_at DESC
`)
	if err != nil {
		return fmt.Errorf("query catalog products: %w", err)
	}
	defer rows.Close()

	managedBaseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("MEDIA_PUBLIC_BASE_URL")), "/")
	if managedBaseURL == "" {
		managedBaseURL = "http://localhost:8080/assets/media"
	}

	stats := auditStats{
		DomainCounts: make(map[string]int),
	}

	for rows.Next() {
		var row productRow
		if err := rows.Scan(&row.ID, &row.CoverImageURL, &row.Images); err != nil {
			return fmt.Errorf("scan product row: %w", err)
		}

		stats.TotalProducts++

		refs := collectImageRefs(row.CoverImageURL, row.Images)
		if len(refs) == 0 {
			stats.ProductsWithoutImage++
			continue
		}

		for _, raw := range refs {
			classifyImageRef(raw, managedBaseURL, &stats)
		}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate product rows: %w", err)
	}

	printMarkdown(stats)
	return nil
}

func collectImageRefs(coverImageURL *string, images []string) []string {
	refs := make([]string, 0, len(images)+1)
	if coverImageURL != nil {
		value := strings.TrimSpace(*coverImageURL)
		if value != "" {
			refs = append(refs, value)
		}
	}
	for _, value := range images {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		refs = append(refs, trimmed)
	}
	return refs
}

func classifyImageRef(raw string, managedBaseURL string, stats *auditStats) {
	if stats == nil {
		return
	}

	value := strings.TrimSpace(raw)
	if value == "" {
		return
	}

	stats.TotalRefs++
	if strings.Contains(value, "api.example.com") {
		stats.PlaceholderRefs++
	}

	if strings.HasPrefix(value, "/assets/img?") {
		stats.ProxyRefs++
		return
	}
	if managedBaseURL != "" && strings.HasPrefix(value, managedBaseURL) {
		stats.ManagedRefs++
	}

	parsed, err := url.Parse(value)
	if err != nil {
		stats.InvalidRefs++
		return
	}
	if !parsed.IsAbs() {
		stats.LocalRefs++
		return
	}

	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if scheme != "http" && scheme != "https" {
		stats.InvalidRefs++
		return
	}

	host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	if host == "" {
		stats.InvalidRefs++
		return
	}

	stats.ExternalRefs++
	stats.DomainCounts[host]++
}

func printMarkdown(stats auditStats) {
	fmt.Println("# Catalog Image Audit")
	fmt.Println()
	fmt.Printf("- total products: %d\n", stats.TotalProducts)
	fmt.Printf("- products without images: %d\n", stats.ProductsWithoutImage)
	fmt.Printf("- total image refs: %d\n", stats.TotalRefs)
	fmt.Printf("- proxy refs (/assets/img): %d\n", stats.ProxyRefs)
	fmt.Printf("- managed refs (%s): %d\n", "MEDIA_PUBLIC_BASE_URL", stats.ManagedRefs)
	fmt.Printf("- external refs (http/https): %d\n", stats.ExternalRefs)
	fmt.Printf("- local refs (non-absolute): %d\n", stats.LocalRefs)
	fmt.Printf("- invalid refs: %d\n", stats.InvalidRefs)
	fmt.Printf("- placeholder refs (api.example.com): %d\n", stats.PlaceholderRefs)
	fmt.Println()
	fmt.Println("## Domain Distribution")
	fmt.Println()

	domains := make([]domainCount, 0, len(stats.DomainCounts))
	for host, count := range stats.DomainCounts {
		domains = append(domains, domainCount{
			Host:  host,
			Count: count,
		})
	}

	sort.Slice(domains, func(i, j int) bool {
		if domains[i].Count == domains[j].Count {
			return domains[i].Host < domains[j].Host
		}
		return domains[i].Count > domains[j].Count
	})

	if len(domains) == 0 {
		fmt.Println("- none")
		return
	}

	for _, item := range domains {
		fmt.Printf("- %s: %d\n", item.Host, item.Count)
	}
}
