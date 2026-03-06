package provider

import (
	"context"
	"fmt"
	"strings"

	"github.com/teamdsb/tmo/services/ai/internal/commerce"
	"github.com/teamdsb/tmo/services/ai/internal/knowledge"
)

type Config struct {
	BaseURL string
	APIKey  string
	Model   string
}

type SuggestionProvider interface {
	Suggest(ctx context.Context, input SuggestionInput) ([]string, error)
}

type SuggestionInput struct {
	Ticket    commerce.AfterSalesTicket
	Messages  []commerce.AfterSalesMessage
	Knowledge knowledge.SearchResult
}

func New(name string, cfg Config) (SuggestionProvider, error) {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "", "mock":
		return &MockProvider{config: cfg}, nil
	default:
		return nil, fmt.Errorf("unsupported provider %q", name)
	}
}

type MockProvider struct {
	config Config
}

func (m *MockProvider) Suggest(_ context.Context, input SuggestionInput) ([]string, error) {
	suggestions := make([]string, 0, 3)

	templateName := ""
	templateEmpathy := "您好，我们先帮您核实情况。"
	templateFollowUp := "麻烦补充订单号、相关照片和具体异常描述，我们会尽快跟进处理。"
	templateEscalation := "该问题需要人工客服继续确认处理方案，我们会同步尽快回复您。"

	if len(input.Knowledge.Templates) > 0 {
		template := input.Knowledge.Templates[0].Template
		templateName = template.Name
		if template.Empathy != "" {
			templateEmpathy = template.Empathy
		}
		if len(template.ClarifyingQuestions) > 0 {
			templateFollowUp = template.ClarifyingQuestions[0]
		}
		if template.EscalationNote != "" {
			templateEscalation = template.EscalationNote
		}
	}

	productHint := ""
	if len(input.Knowledge.Products) > 0 {
		match := input.Knowledge.Products[0].Document
		productHint = matchedProductHint(match)
	}

	first := templateEmpathy
	if templateName != "" {
		first += " 当前我们先按" + templateName + "场景为您核实。"
	}
	suggestions = append(suggestions, first)

	second := templateFollowUp
	if productHint != "" {
		second += " 结合您当前描述，我们先同步核对 " + productHint + " 的规格与发货信息。"
	}
	suggestions = append(suggestions, second)

	suggestions = append(suggestions, templateEscalation)
	return suggestions, nil
}

func matchedProductHint(product knowledge.ProductDocument) string {
	if len(product.SKUs) == 0 {
		return product.Name
	}

	sku := product.SKUs[0]
	parts := []string{product.Name}
	if sku.Spec != "" {
		parts = append(parts, sku.Spec)
	}
	if sku.Unit != "" {
		parts = append(parts, "单位"+sku.Unit)
	}
	return strings.Join(parts, " ")
}
