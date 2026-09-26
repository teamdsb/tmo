package catalogspec

import (
	"reflect"
	"testing"
)

func TestRecognizeAttributesUsesDeclaredUnitsAndKeepsEvidenceValues(t *testing.T) {
	attributes := []SourceAttribute{{Name: "螺纹直径", Text: "M5"}, {Name: "长度", Number: "16", Unit: "mm"}, {Name: "螺距", Number: "0.8", Unit: "mm"}, {Name: "性能等级", Text: "8.8"}, {Name: "头高", Number: "5", Unit: "mm"}}
	result := RecognizeAttributes("内六角圆柱头螺钉（全牙）", "untrusted display", attributes)
	if len(result.Issues) > 0 || result.Spec != "M5 / 16mm / 0.8mm" || !reflect.DeepEqual(result.Dimensions, []string{"螺纹直径", "长度", "螺距"}) || result.Attributes["头高"] != "5mm" || result.Attributes["性能等级"] != "8.8" {
		t.Fatalf("unexpected recognition: %+v", result)
	}
	attributes[1].Unit = ""
	result = RecognizeAttributes("螺钉", "M5x16mm", attributes)
	if len(result.Issues) != 1 || result.Issues[0].Code != "DIMENSION_UNIT_MISSING" {
		t.Fatalf("inferred unit from display: %+v", result)
	}
}

func TestRecognizeAttributesProfiles(t *testing.T) {
	tests := []struct {
		name       string
		attributes []SourceAttribute
		want       string
	}{
		{"带齿六角法兰螺母", []SourceAttribute{{Name: "螺纹直径", Text: "M6"}}, "M6"},
		{"板式平焊法兰", []SourceAttribute{{Name: "公称通径", Text: "DN50"}, {Name: "连接管外径", Number: "60.3", Unit: "mm"}}, "DN50 / 60.3mm"},
		{"EPE珍珠棉（卷材）", []SourceAttribute{{Name: "宽度", Number: "1250", Unit: "mm"}, {Name: "厚度", Number: "4", Unit: "mm"}, {Name: "卷长", Number: "180", Unit: "m"}}, "1250mm / 4mm / 180m"},
		{"背胶魔术贴", []SourceAttribute{{Name: "宽度", Number: "50", Unit: "mm"}, {Name: "颜色", Text: "黑色"}, {Name: "勾毛面", Text: "毛面"}}, "50mm / 黑色 / 毛面"},
		{"包边带", []SourceAttribute{{Name: "宽度", Number: "22", Unit: "mm"}, {Name: "纱线规格标识", Text: "600D"}, {Name: "颜色", Text: "红色"}}, "22mm / 600D / 红色"},
		{"管钳", []SourceAttribute{{Name: "标称尺寸原文", Text: "12寸"}}, "12寸"},
		{"内六角扳手", []SourceAttribute{{Name: "标称规格", Number: "6", Unit: "mm"}}, "6mm"},
		{"电工胶带", []SourceAttribute{{Name: "宽度", Number: "16", Unit: "mm"}, {Name: "卷长", Number: "15", Unit: "m"}}, "16mm / 15m"},
		{"笔记本", []SourceAttribute{{Name: "幅面", Text: "A4"}}, "A4"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := RecognizeAttributes(test.name, "", test.attributes)
			if len(result.Issues) > 0 || result.Spec != test.want {
				t.Fatalf("got %+v, want %s", result, test.want)
			}
		})
	}
}

func TestRecognizeAttributesRejectsConflictingUnitColumns(t *testing.T) {
	result := RecognizeAttributes("内六角扳手", "", []SourceAttribute{{Name: "标称规格", Text: "6mm", Unit: "m"}})
	if len(result.Issues) == 0 || result.Issues[0].Code != "ATTRIBUTE_UNIT_CONFLICT" {
		t.Fatalf("conflicting explicit units accepted: %+v", result)
	}
	result = RecognizeAttributes("内六角扳手", "", []SourceAttribute{{Name: "标称规格", Text: "6mm", Unit: "毫米"}})
	if len(result.Issues) > 0 {
		t.Fatalf("equivalent units rejected: %+v", result)
	}
}

func TestLegacyHistoricalSamples(t *testing.T) {
	tests := []struct{ name, spec, want, issue string }{
		{"纸箱", "620*600*340", "", "DIMENSION_UNIT_MISSING"},
		{"纸箱", "62*42*45CM", "62cm / 42cm / 45cm", ""},
		{"纸箱", "760*490*320m", "760m / 490m / 320m", ""},
		{"轴承", "30309", "30309", ""},
		{"气管接头", "PC6-M12X1.5", "PC6-M12X1.5", ""},
		{"气管接头", "PL6-01", "PL6-01", ""},
		{"气管接头", "∅6变∅8", "", "SPEC_UNRECOGNIZED"},
		{"聚丙烯", "EPP30黑小粒子", "EPP30黑小粒子", ""},
		{"辅料", "3722p", "", "GENERIC_PRODUCT_NAME"},
		{"包边带", "红色600D 2.2cm", "2.2cm / 600D / 红色", ""},
		{"魔术贴", "黑色勾面/25*25", "", "DIMENSION_UNIT_MISSING"},
		{"魔术贴", "4cm*25m黑色（毛面）不背胶", "4cm / 黑色 / 毛面", ""},
		{"加热圈", "100*100mm 1000w220v", "", "SPEC_AMBIGUOUS"},
		{"冲切机", "", "", "SPEC_VALUE_MISSING"},
		{"劳保鞋", "备注填写大小", "", "SPEC_UNRECOGNIZED"},
	}
	for _, test := range tests {
		t.Run(test.name+test.spec, func(t *testing.T) {
			result := RecognizeLegacySpec(test.name, test.spec)
			if test.issue != "" {
				if len(result.Issues) == 0 || result.Issues[0].Code != test.issue {
					t.Fatalf("got %+v", result)
				}
			} else if len(result.Issues) > 0 || result.Spec != test.want {
				t.Fatalf("got %+v want %s", result, test.want)
			}
		})
	}
}
