package provider

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/ai/internal/commerce"
	"github.com/teamdsb/tmo/services/ai/internal/knowledge"
)

func TestMockProviderSuggestsStableRepliesWithProductHint(t *testing.T) {
	provider, err := New("mock", Config{})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	suggestions, err := provider.Suggest(context.Background(), SuggestionInput{
		Ticket: commerce.AfterSalesTicket{
			ID:          uuid.MustParse("11111111-1111-1111-1111-111111111111"),
			Subject:     "收到的型号不对",
			Description: "客户反馈规格不符",
		},
		Knowledge: knowledge.SearchResult{
			Products: []knowledge.ProductMatch{
				{
					Document: knowledge.ProductDocument{
						Name: "阻燃电缆 3x2.5",
						SKUs: []knowledge.ProductSKU{
							{
								Spec: "100m/卷",
								Unit: "卷",
							},
						},
					},
					Score: 10,
				},
			},
			Templates: []knowledge.TemplateMatch{
				{
					Template: knowledge.Template{
						ID:                  "spec-mismatch",
						Name:                "规格不符",
						Empathy:             "收到，我们先帮您核对下订单规格和实物参数。",
						ClarifyingQuestions: []string{"麻烦拍一下产品标签或铭牌，我们先核对型号和规格。"},
						EscalationNote:      "若涉及下单选型争议或需改发替换，转人工继续处理。",
					},
					Score: 8,
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("Suggest() error = %v", err)
	}
	if len(suggestions) != 3 {
		t.Fatalf("expected 3 suggestions, got %d", len(suggestions))
	}
	if !strings.Contains(strings.Join(suggestions, " "), "阻燃电缆 3x2.5") {
		t.Fatalf("expected product hint in suggestions, got %#v", suggestions)
	}
	if !strings.Contains(suggestions[0], "规格不符") {
		t.Fatalf("expected template name in first suggestion, got %q", suggestions[0])
	}
}

func TestNewRejectsUnsupportedProvider(t *testing.T) {
	_, err := New("unsupported", Config{})
	if err == nil {
		t.Fatalf("expected unsupported provider error")
	}
}
