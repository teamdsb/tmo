package knowledge

import (
	"context"
	"encoding/json"
	"log/slog"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/ai/internal/commerce"
)

type CatalogLoader interface {
	ListProductsPage(ctx context.Context, page, pageSize int) (commerce.PagedProductList, error)
	GetProductDetail(ctx context.Context, productID uuid.UUID) (commerce.ProductDetail, error)
}

type Base struct {
	loader          CatalogLoader
	logger          *slog.Logger
	refreshInterval time.Duration
	templates       []Template

	mu       sync.RWMutex
	products []ProductDocument
}

type Template struct {
	ID                  string   `json:"id"`
	Name                string   `json:"name"`
	Keywords            []string `json:"keywords"`
	Empathy             string   `json:"empathy"`
	Guidance            []string `json:"guidance"`
	ClarifyingQuestions []string `json:"clarifyingQuestions"`
	EscalationNote      string   `json:"escalationNote"`
}

type ProductDocument struct {
	ID               uuid.UUID
	Name             string
	Description      string
	FilterDimensions []string
	SearchText       string
	SKUs             []ProductSKU
}

type ProductSKU struct {
	Name       string
	Spec       string
	SkuCode    string
	Unit       string
	Attributes map[string]string
	PriceTiers []commerce.PriceTier
}

type ProductMatch struct {
	Document ProductDocument
	Score    int
}

type TemplateMatch struct {
	Template Template
	Score    int
}

type SearchResult struct {
	Products  []ProductMatch
	Templates []TemplateMatch
}

func NewBase(loader CatalogLoader, logger *slog.Logger, refreshInterval time.Duration) (*Base, error) {
	if refreshInterval <= 0 {
		refreshInterval = 5 * time.Minute
	}

	var templates []Template
	if err := json.Unmarshal(sopTemplatesJSON, &templates); err != nil {
		return nil, err
	}

	return &Base{
		loader:          loader,
		logger:          logger,
		refreshInterval: refreshInterval,
		templates:       templates,
	}, nil
}

func (b *Base) Start(ctx context.Context) {
	go func() {
		if err := b.Refresh(ctx); err != nil && b.logger != nil {
			b.logger.Warn("knowledge refresh failed", "error", err)
		}

		ticker := time.NewTicker(b.refreshInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := b.Refresh(ctx); err != nil && b.logger != nil {
					b.logger.Warn("knowledge refresh failed", "error", err)
				}
			}
		}
	}()
}

func (b *Base) Refresh(ctx context.Context) error {
	const pageSize = 100

	docs := make([]ProductDocument, 0, pageSize)
	for page := 1; ; page++ {
		response, err := b.loader.ListProductsPage(ctx, page, pageSize)
		if err != nil {
			return err
		}

		for _, item := range response.Items {
			detail, err := b.loader.GetProductDetail(ctx, item.ID)
			if err != nil {
				return err
			}
			docs = append(docs, newProductDocument(detail))
		}

		if len(docs) >= response.Total || len(response.Items) == 0 {
			break
		}
	}

	b.mu.Lock()
	b.products = docs
	b.mu.Unlock()
	return nil
}

func (b *Base) Search(query string, limit int) SearchResult {
	if limit <= 0 {
		limit = 3
	}

	b.mu.RLock()
	products := make([]ProductDocument, len(b.products))
	copy(products, b.products)
	templates := make([]Template, len(b.templates))
	copy(templates, b.templates)
	b.mu.RUnlock()

	productMatches := scoreProducts(products, query, limit)
	templateMatches := scoreTemplates(templates, query, limit)

	return SearchResult{
		Products:  productMatches,
		Templates: templateMatches,
	}
}

func newProductDocument(detail commerce.ProductDetail) ProductDocument {
	doc := ProductDocument{
		ID:               detail.Product.ID,
		Name:             detail.Product.Name,
		FilterDimensions: append([]string(nil), detail.Product.FilterDimensions...),
		SKUs:             make([]ProductSKU, 0, len(detail.SKUs)),
	}
	if detail.Product.Description != nil {
		doc.Description = *detail.Product.Description
	}

	parts := []string{doc.Name, doc.Description}
	parts = append(parts, doc.FilterDimensions...)
	for _, sku := range detail.SKUs {
		entry := ProductSKU{
			Name:       sku.Name,
			Attributes: map[string]string{},
			PriceTiers: append([]commerce.PriceTier(nil), sku.PriceTiers...),
		}
		if sku.Spec != nil {
			entry.Spec = *sku.Spec
			parts = append(parts, entry.Spec)
		}
		if sku.SkuCode != nil {
			entry.SkuCode = *sku.SkuCode
			parts = append(parts, entry.SkuCode)
		}
		if sku.Unit != nil {
			entry.Unit = *sku.Unit
			parts = append(parts, entry.Unit)
		}
		for key, value := range sku.Attributes {
			entry.Attributes[key] = value
			parts = append(parts, key, value)
		}
		parts = append(parts, entry.Name)
		doc.SKUs = append(doc.SKUs, entry)
	}

	doc.SearchText = normalize(strings.Join(parts, " "))
	return doc
}

func scoreProducts(products []ProductDocument, query string, limit int) []ProductMatch {
	queryNorm := normalize(query)
	queryTokens := tokenize(queryNorm)
	if len(queryTokens) == 0 {
		return nil
	}

	matches := make([]ProductMatch, 0, limit)
	for _, product := range products {
		score := 0
		if strings.Contains(product.SearchText, queryNorm) {
			score += 12
		}
		for _, token := range queryTokens {
			if token == "" {
				continue
			}
			if strings.Contains(product.SearchText, token) {
				score += 2
			}
			if strings.Contains(normalize(product.Name), token) {
				score += 3
			}
		}
		if score == 0 {
			continue
		}
		matches = append(matches, ProductMatch{Document: product, Score: score})
	}

	sort.Slice(matches, func(i, j int) bool {
		if matches[i].Score == matches[j].Score {
			return matches[i].Document.Name < matches[j].Document.Name
		}
		return matches[i].Score > matches[j].Score
	})

	if len(matches) > limit {
		matches = matches[:limit]
	}
	return matches
}

func scoreTemplates(templates []Template, query string, limit int) []TemplateMatch {
	queryNorm := normalize(query)
	queryTokens := tokenize(queryNorm)
	matches := make([]TemplateMatch, 0, limit)

	for _, template := range templates {
		score := 0
		for _, keyword := range template.Keywords {
			normalizedKeyword := normalize(keyword)
			if normalizedKeyword == "" {
				continue
			}
			if strings.Contains(queryNorm, normalizedKeyword) {
				score += 5
			}
			for _, token := range queryTokens {
				if strings.Contains(normalizedKeyword, token) {
					score++
				}
			}
		}
		if score == 0 {
			continue
		}
		matches = append(matches, TemplateMatch{Template: template, Score: score})
	}

	sort.Slice(matches, func(i, j int) bool {
		if matches[i].Score == matches[j].Score {
			return matches[i].Template.Name < matches[j].Template.Name
		}
		return matches[i].Score > matches[j].Score
	})

	if len(matches) > limit {
		matches = matches[:limit]
	}
	return matches
}

func normalize(value string) string {
	lower := strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	builder.Grow(len(lower))

	lastSpace := false
	for _, r := range lower {
		switch {
		case unicode.IsSpace(r):
			if !lastSpace {
				builder.WriteByte(' ')
				lastSpace = true
			}
		case unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.In(r, unicode.Han):
			builder.WriteRune(r)
			lastSpace = false
		default:
			if !lastSpace {
				builder.WriteByte(' ')
				lastSpace = true
			}
		}
	}

	return strings.TrimSpace(builder.String())
}

func tokenize(normalized string) []string {
	parts := strings.Fields(normalized)
	seen := make(map[string]struct{}, len(parts)*2)
	tokens := make([]string, 0, len(parts)*2)

	appendToken := func(token string) {
		token = strings.TrimSpace(token)
		if token == "" {
			return
		}
		if _, exists := seen[token]; exists {
			return
		}
		seen[token] = struct{}{}
		tokens = append(tokens, token)
	}

	for _, part := range parts {
		appendToken(part)
		if utf8.RuneCountInString(part) >= 2 && containsHan(part) {
			runes := []rune(part)
			for i := 0; i < len(runes)-1; i++ {
				appendToken(string(runes[i : i+2]))
			}
		}
	}

	return tokens
}

func containsHan(value string) bool {
	for _, r := range value {
		if unicode.In(r, unicode.Han) {
			return true
		}
	}
	return false
}
