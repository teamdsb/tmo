package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultDSN                  = "postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable"
	defaultTimeout              = 30 * time.Second
	defaultHTTPTimeout          = 20 * time.Second
	defaultMaxBytes             = int64(8 * 1024 * 1024)
	defaultOutputDir            = "./infra/dev/media"
	defaultPublicBaseURL        = "http://localhost:8080/assets/media"
	defaultDryRun               = true
	defaultSourceAllowlistHosts = "images.unsplash.com"
)

type productRow struct {
	ID            uuid.UUID
	CoverImageURL *string
	Images        []string
}

type migrateConfig struct {
	DSN             string
	Timeout         time.Duration
	HTTPTimeout     time.Duration
	MaxBytes        int64
	OutputDir       string
	PublicBaseURL   string
	DryRun          bool
	Limit           int
	SourceAllowlist []string
}

type migrateResult struct {
	OriginalURL string
	StorageURL  string
	Status      string
	SHA256      string
	Error       string
}

type migrateStats struct {
	ProductsVisited int
	ProductsUpdated int
	RefsVisited     int
	RefsMigrated    int
	RefsFailed      int
	RefsSkipped     int
}

type migrator struct {
	client          *http.Client
	maxBytes        int64
	outputDir       string
	publicBaseURL   string
	dryRun          bool
	sourceAllowlist []string
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), cfg.Timeout)
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DSN)
	if err != nil {
		return fmt.Errorf("connect to database: %w", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping database: %w", err)
	}

	products, err := listProducts(ctx, pool, cfg.Limit)
	if err != nil {
		return err
	}
	if len(products) == 0 {
		fmt.Println("catalog-image-migrate: no products found, nothing to do.")
		return nil
	}

	m := &migrator{
		client: &http.Client{
			Timeout: cfg.HTTPTimeout,
		},
		maxBytes:        cfg.MaxBytes,
		outputDir:       cfg.OutputDir,
		publicBaseURL:   strings.TrimRight(cfg.PublicBaseURL, "/"),
		dryRun:          cfg.DryRun,
		sourceAllowlist: cfg.SourceAllowlist,
	}

	var tx pgx.Tx
	if !cfg.DryRun {
		tx, err = pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("begin transaction: %w", err)
		}
		defer func() {
			_ = tx.Rollback(ctx)
		}()
	}

	assetTableReady, err := hasMediaAssetTable(ctx, pool)
	if err != nil {
		return err
	}

	stats := migrateStats{}
	for _, product := range products {
		changed, coverImageURL, images, results := m.migrateProduct(ctx, product)
		stats.ProductsVisited++
		stats.RefsVisited += len(results)
		for _, result := range results {
			switch result.Status {
			case "success":
				stats.RefsMigrated++
			case "failed":
				stats.RefsFailed++
			default:
				stats.RefsSkipped++
			}

			if !cfg.DryRun && assetTableReady {
				if err := upsertMediaAsset(ctx, tx, product.ID, result); err != nil {
					return err
				}
			}
		}

		if !changed || cfg.DryRun {
			continue
		}

		if err := updateProductImages(ctx, tx, product.ID, coverImageURL, images); err != nil {
			return err
		}
		stats.ProductsUpdated++
	}

	if !cfg.DryRun {
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit transaction: %w", err)
		}
	}

	fmt.Println("catalog-image-migrate summary:")
	fmt.Printf("- dryRun: %v\n", cfg.DryRun)
	fmt.Printf("- products visited: %d\n", stats.ProductsVisited)
	fmt.Printf("- products updated: %d\n", stats.ProductsUpdated)
	fmt.Printf("- image refs visited: %d\n", stats.RefsVisited)
	fmt.Printf("- image refs migrated: %d\n", stats.RefsMigrated)
	fmt.Printf("- image refs skipped: %d\n", stats.RefsSkipped)
	fmt.Printf("- image refs failed: %d\n", stats.RefsFailed)
	if !assetTableReady {
		fmt.Println("- media asset table: missing (skipped status persistence)")
	}
	fmt.Printf("- output dir: %s\n", cfg.OutputDir)
	fmt.Printf("- public base url: %s\n", cfg.PublicBaseURL)
	return nil
}

func loadConfig() (migrateConfig, error) {
	cfg := migrateConfig{
		DSN:             readStringEnv("COMMERCE_DB_DSN", defaultDSN),
		Timeout:         readDurationEnv("CATALOG_IMAGE_MIGRATE_TIMEOUT", defaultTimeout),
		HTTPTimeout:     readDurationEnv("CATALOG_IMAGE_MIGRATE_HTTP_TIMEOUT", defaultHTTPTimeout),
		MaxBytes:        readInt64Env("CATALOG_IMAGE_MIGRATE_MAX_BYTES", defaultMaxBytes),
		OutputDir:       readStringEnv("MEDIA_LOCAL_OUTPUT_DIR", defaultOutputDir),
		PublicBaseURL:   readStringEnv("MEDIA_PUBLIC_BASE_URL", defaultPublicBaseURL),
		DryRun:          readBoolEnv("CATALOG_IMAGE_MIGRATE_DRY_RUN", defaultDryRun),
		Limit:           readIntEnv("CATALOG_IMAGE_MIGRATE_LIMIT", 0),
		SourceAllowlist: normalizeAllowlist(readStringEnv("CATALOG_IMAGE_SOURCE_ALLOWLIST", defaultSourceAllowlistHosts)),
	}

	if cfg.MaxBytes <= 0 {
		cfg.MaxBytes = defaultMaxBytes
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = defaultTimeout
	}
	if cfg.HTTPTimeout <= 0 {
		cfg.HTTPTimeout = defaultHTTPTimeout
	}
	if strings.TrimSpace(cfg.OutputDir) == "" {
		return migrateConfig{}, errors.New("MEDIA_LOCAL_OUTPUT_DIR is empty")
	}
	if strings.TrimSpace(cfg.PublicBaseURL) == "" {
		return migrateConfig{}, errors.New("MEDIA_PUBLIC_BASE_URL is empty")
	}
	if _, err := url.ParseRequestURI(cfg.PublicBaseURL); err != nil {
		return migrateConfig{}, fmt.Errorf("MEDIA_PUBLIC_BASE_URL is invalid: %w", err)
	}
	return cfg, nil
}

func listProducts(ctx context.Context, pool *pgxpool.Pool, limit int) ([]productRow, error) {
	const baseQuery = `
SELECT id, cover_image_url, images
FROM catalog_products
ORDER BY created_at DESC
`

	var rows pgx.Rows
	var err error
	if limit > 0 {
		rows, err = pool.Query(ctx, baseQuery+"LIMIT $1", limit)
	} else {
		rows, err = pool.Query(ctx, baseQuery)
	}
	if err != nil {
		return nil, fmt.Errorf("query catalog products: %w", err)
	}
	defer rows.Close()

	result := make([]productRow, 0, 64)
	for rows.Next() {
		var row productRow
		if err := rows.Scan(&row.ID, &row.CoverImageURL, &row.Images); err != nil {
			return nil, fmt.Errorf("scan catalog product: %w", err)
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate catalog products: %w", err)
	}
	return result, nil
}

func hasMediaAssetTable(ctx context.Context, pool *pgxpool.Pool) (bool, error) {
	var exists bool
	if err := pool.QueryRow(ctx, `SELECT to_regclass('public.catalog_media_assets') IS NOT NULL`).Scan(&exists); err != nil {
		return false, fmt.Errorf("check catalog_media_assets table: %w", err)
	}
	return exists, nil
}

func upsertMediaAsset(ctx context.Context, tx pgx.Tx, productID uuid.UUID, result migrateResult) error {
	if tx == nil {
		return nil
	}
	if _, err := tx.Exec(ctx, `
INSERT INTO catalog_media_assets (
  product_id,
  source_url,
  storage_url,
  content_sha256,
  status,
  error_message
)
VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5, NULLIF($6, ''))
ON CONFLICT (product_id, source_url) DO UPDATE
SET storage_url = EXCLUDED.storage_url,
    content_sha256 = EXCLUDED.content_sha256,
    status = EXCLUDED.status,
    error_message = EXCLUDED.error_message,
    updated_at = now()
`, productID, result.OriginalURL, result.StorageURL, result.SHA256, result.Status, result.Error); err != nil {
		return fmt.Errorf("upsert catalog_media_assets (%s): %w", result.OriginalURL, err)
	}
	return nil
}

func updateProductImages(ctx context.Context, tx pgx.Tx, productID uuid.UUID, coverImageURL *string, images []string) error {
	if tx == nil {
		return errors.New("transaction is required for update")
	}
	if _, err := tx.Exec(ctx, `
UPDATE catalog_products
SET cover_image_url = $2,
    images = $3,
    updated_at = now()
WHERE id = $1
`, productID, coverImageURL, images); err != nil {
		return fmt.Errorf("update catalog product %s: %w", productID, err)
	}
	return nil
}

func (m *migrator) migrateProduct(ctx context.Context, product productRow) (bool, *string, []string, []migrateResult) {
	results := make([]migrateResult, 0, len(product.Images)+1)
	changed := false

	coverImageURL := cloneStringPtr(product.CoverImageURL)
	if coverImageURL != nil {
		result := m.migrateURL(ctx, *coverImageURL)
		results = append(results, result)
		if result.Status == "success" && result.StorageURL != "" && result.StorageURL != *coverImageURL {
			coverImageURL = strPtr(result.StorageURL)
			changed = true
		}
	}

	images := make([]string, len(product.Images))
	copy(images, product.Images)
	for i := range images {
		result := m.migrateURL(ctx, images[i])
		results = append(results, result)
		if result.Status == "success" && result.StorageURL != "" && result.StorageURL != images[i] {
			images[i] = result.StorageURL
			changed = true
		}
	}

	return changed, coverImageURL, images, results
}

func (m *migrator) migrateURL(ctx context.Context, rawURL string) migrateResult {
	result := migrateResult{
		OriginalURL: strings.TrimSpace(rawURL),
		Status:      "skipped",
	}
	if result.OriginalURL == "" {
		result.Error = "empty url"
		return result
	}

	parsed, err := url.Parse(result.OriginalURL)
	if err != nil {
		result.Status = "failed"
		result.Error = "invalid url"
		return result
	}
	if !parsed.IsAbs() {
		result.Error = "non-absolute url"
		return result
	}

	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if scheme != "http" && scheme != "https" {
		result.Error = "unsupported scheme"
		return result
	}

	if m.isMediaPublicURL(parsed) {
		result.Error = "already migrated"
		result.StorageURL = result.OriginalURL
		return result
	}

	host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	if !isHostAllowed(host, m.sourceAllowlist) {
		result.Error = "host not in source allowlist"
		return result
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, result.OriginalURL, nil)
	if err != nil {
		result.Status = "failed"
		result.Error = "failed to create upstream request"
		return result
	}
	request.Header.Set("Accept", "image/*,*/*;q=0.8")
	request.Header.Set("User-Agent", "tmo-catalog-image-migrate/1.0")

	response, err := m.client.Do(request)
	if err != nil {
		result.Status = "failed"
		result.Error = fmt.Sprintf("download failed: %s", err.Error())
		return result
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		result.Status = "failed"
		result.Error = fmt.Sprintf("upstream bad status: %d", response.StatusCode)
		return result
	}

	payload, err := io.ReadAll(io.LimitReader(response.Body, m.maxBytes+1))
	if err != nil {
		result.Status = "failed"
		result.Error = fmt.Sprintf("read upstream body failed: %s", err.Error())
		return result
	}
	if int64(len(payload)) > m.maxBytes {
		result.Status = "failed"
		result.Error = fmt.Sprintf("image too large (maxBytes=%d)", m.maxBytes)
		return result
	}

	sum := sha256.Sum256(payload)
	sha := hex.EncodeToString(sum[:])
	ext := inferExt(strings.TrimSpace(response.Header.Get("Content-Type")), parsed.Path)
	relPath := path.Join("catalog", sha[:2], sha+ext)
	absPath := filepath.Join(m.outputDir, filepath.FromSlash(relPath))

	if !m.dryRun {
		if err := os.MkdirAll(filepath.Dir(absPath), 0o755); err != nil {
			result.Status = "failed"
			result.Error = fmt.Sprintf("mkdir media dir failed: %s", err.Error())
			return result
		}
		if err := os.WriteFile(absPath, payload, 0o644); err != nil {
			result.Status = "failed"
			result.Error = fmt.Sprintf("write media file failed: %s", err.Error())
			return result
		}
	}

	result.SHA256 = sha
	result.StorageURL = m.publicBaseURL + "/" + relPath
	result.Status = "success"
	result.Error = ""
	return result
}

func (m *migrator) isMediaPublicURL(target *url.URL) bool {
	if target == nil {
		return false
	}
	publicParsed, err := url.Parse(m.publicBaseURL)
	if err != nil {
		return false
	}
	if !strings.EqualFold(target.Scheme, publicParsed.Scheme) {
		return false
	}
	if !strings.EqualFold(target.Host, publicParsed.Host) {
		return false
	}
	publicPath := strings.TrimRight(publicParsed.Path, "/")
	if publicPath == "" {
		return true
	}
	targetPath := strings.TrimRight(target.Path, "/")
	return targetPath == publicPath || strings.HasPrefix(targetPath, publicPath+"/")
}

func inferExt(contentType, sourcePath string) string {
	if contentType != "" {
		parts := strings.Split(contentType, ";")
		mediaType := strings.TrimSpace(parts[0])
		if mediaType != "" {
			if exts, err := mime.ExtensionsByType(mediaType); err == nil && len(exts) > 0 {
				sort.Strings(exts)
				return exts[0]
			}
		}
	}

	ext := strings.ToLower(strings.TrimSpace(path.Ext(sourcePath)))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg":
		return ext
	default:
		return ".jpg"
	}
}

func normalizeAllowlist(raw string) []string {
	items := strings.Split(raw, ",")
	hosts := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		host := strings.ToLower(strings.TrimSpace(item))
		if host == "" {
			continue
		}
		if _, exists := seen[host]; exists {
			continue
		}
		seen[host] = struct{}{}
		hosts = append(hosts, host)
	}
	sort.Strings(hosts)
	return hosts
}

func isHostAllowed(host string, allowlist []string) bool {
	normalized := strings.ToLower(strings.TrimSpace(host))
	if normalized == "" {
		return false
	}
	if len(allowlist) == 0 {
		return true
	}
	for _, allowed := range allowlist {
		if normalized == allowed {
			return true
		}
		if strings.HasSuffix(normalized, "."+allowed) {
			return true
		}
	}
	return false
}

func readStringEnv(name, fallback string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}
	return value
}

func readDurationEnv(name string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func readIntEnv(name string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback
	}
	var parsed int
	if _, err := fmt.Sscanf(raw, "%d", &parsed); err != nil {
		return fallback
	}
	return parsed
}

func readInt64Env(name string, fallback int64) int64 {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback
	}
	var parsed int64
	if _, err := fmt.Sscanf(raw, "%d", &parsed); err != nil {
		return fallback
	}
	return parsed
}

func readBoolEnv(name string, fallback bool) bool {
	raw := strings.TrimSpace(strings.ToLower(os.Getenv(name)))
	if raw == "" {
		return fallback
	}
	switch raw {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func cloneStringPtr(value *string) *string {
	if value == nil {
		return nil
	}
	copied := *value
	return &copied
}

func strPtr(value string) *string {
	copied := value
	return &copied
}
