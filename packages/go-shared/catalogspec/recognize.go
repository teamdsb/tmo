package catalogspec

import (
	"fmt"
	"regexp"
	"strings"
)

// SourceAttribute keeps evidence separate from the value used for SKU selection.
type SourceAttribute struct {
	Name   string `json:"name"`
	Number string `json:"number,omitempty"`
	Text   string `json:"text,omitempty"`
	Unit   string `json:"unit,omitempty"`
	Basis  string `json:"basis,omitempty"`
	Source string `json:"source,omitempty"`
}

type RecognitionIssue struct {
	Code    string
	Message string
}

type Recognition struct {
	Dimensions []string
	Attributes map[string]string
	Spec       string
	Issues     []RecognitionIssue
}

type recognitionDimension struct {
	name     string
	physical bool
}

var (
	measurePattern          = regexp.MustCompile(`(?i)^\s*\d+(?:\.\d+)?\s*(mm|cm|m|毫米|厘米|米|英寸|寸|in|inch|ft|um|μm)\s*$`)
	boxPattern              = regexp.MustCompile(`(?i)^\s*(\d+(?:\.\d+)?)\s*[*x×]\s*(\d+(?:\.\d+)?)\s*[*x×]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|毫米|厘米|米)?\s*$`)
	unknownDimensionPattern = regexp.MustCompile(`(?i)\d\s*[*x×]\s*\d`)
	widthPattern            = regexp.MustCompile(`(?i)(\d+(?:\.\d+)?)\s*(mm|cm|毫米|厘米)`)
	yarnPattern             = regexp.MustCompile(`(?i)\b\d+D\b`)
	metricNominalPattern    = regexp.MustCompile(`(?i)^(?:M\d+(?:\.\d+)?|DN\d+|A[0-9])$`)
	modelPattern            = regexp.MustCompile(`(?i)^[a-z][a-z0-9]*(?:[-./][a-z0-9]+)*$`)
	connectorModelPattern   = regexp.MustCompile(`(?i)^[A-Z]{1,6}\d+(?:[-/][A-Z0-9.]+)+(?:X\d+(?:\.\d+)?)?$`)
	digitPattern            = regexp.MustCompile(`\d`)
	bearingPattern          = regexp.MustCompile(`^\d{4,6}(?:[-/][A-Za-z0-9]+)?$`)
	threadDiameterPattern   = regexp.MustCompile(`(?i)^M\s*\d+(?:\.\d+)?$`)
	nominalDiameterPattern  = regexp.MustCompile(`(?i)^DN\s*\d+$`)
	lengthUnitPattern       = regexp.MustCompile(`(?i)(mm|cm|毫米|厘米|米|寸)`)
	polymerModelPattern     = regexp.MustCompile(`(?i)^(EPP|EPE|PP|PE)\d+`)
)

func AttributeValue(attribute SourceAttribute) string {
	value := strings.TrimSpace(attribute.Text)
	if value == "" {
		value = strings.TrimSpace(attribute.Number)
	}
	unit := strings.TrimSpace(attribute.Unit)
	if match := measurePattern.FindStringSubmatch(value); len(match) > 1 && canonicalLengthUnit(match[1]) == canonicalLengthUnit(unit) {
		return value
	}
	if value != "" && unit != "" && !strings.HasSuffix(strings.ToLower(value), strings.ToLower(unit)) {
		value += unit
	}
	return value
}

// RecognizeAttributes uses named source fields; it never builds a Cartesian product or supplies missing units.
func RecognizeAttributes(productName, originalSpec string, attributes []SourceAttribute) Recognition {
	result := Recognition{Attributes: map[string]string{}}
	byName := map[string]SourceAttribute{}
	for _, attribute := range attributes {
		name := strings.TrimSpace(attribute.Name)
		if name == "" {
			continue
		}
		value := AttributeValue(attribute)
		if strings.TrimSpace(attribute.Number) != "" && strings.TrimSpace(attribute.Text) != "" && strings.TrimSpace(attribute.Number) != strings.TrimSpace(attribute.Text) {
			result.Issues = append(result.Issues, RecognitionIssue{"ATTRIBUTE_VALUE_CONFLICT", fmt.Sprintf("属性%s的数值与文本值不一致", name)})
		}
		if match := measurePattern.FindStringSubmatch(strings.TrimSpace(attribute.Text)); len(match) > 1 && strings.TrimSpace(attribute.Unit) != "" && canonicalLengthUnit(match[1]) != canonicalLengthUnit(attribute.Unit) {
			result.Issues = append(result.Issues, RecognitionIssue{"ATTRIBUTE_UNIT_CONFLICT", fmt.Sprintf("属性%s的文本单位与单位列不一致", name)})
		}
		if previous, exists := result.Attributes[name]; exists && previous != value {
			result.Issues = append(result.Issues, RecognitionIssue{"ATTRIBUTE_CONFLICT", fmt.Sprintf("属性%s存在互相冲突的来源值", name)})
			continue
		}
		result.Attributes[name], byName[name] = value, attribute
	}
	profile := profileForProduct(productName)
	if len(profile) == 0 {
		result.Issues = append(result.Issues, RecognitionIssue{"SPEC_UNRECOGNIZED", "未找到能够确定规格层级的属性组合"})
		return result
	}
	for _, dimension := range profile {
		attribute, exists := byName[dimension.name]
		value := AttributeValue(attribute)
		if !exists || value == "" {
			result.Issues = append(result.Issues, RecognitionIssue{"SPEC_VALUE_MISSING", fmt.Sprintf("缺少规格属性%s", dimension.name)})
			continue
		}
		if dimension.physical && !measurePattern.MatchString(value) {
			result.Issues = append(result.Issues, RecognitionIssue{"DIMENSION_UNIT_MISSING", fmt.Sprintf("规格属性%s缺少明确的尺寸单位", dimension.name)})
			continue
		}
		if (dimension.name == "螺纹直径" && !threadDiameterPattern.MatchString(value) && !measurePattern.MatchString(value)) || (dimension.name == "公称通径" && !nominalDiameterPattern.MatchString(value) && !measurePattern.MatchString(value)) {
			result.Issues = append(result.Issues, RecognitionIssue{"DIMENSION_UNIT_MISSING", fmt.Sprintf("规格属性%s缺少M/DN标识或明确的尺寸单位", dimension.name)})
			continue
		}
		result.Dimensions = append(result.Dimensions, dimension.name)
	}
	if len(result.Issues) == 0 {
		_, result.Spec, _ = NormalizeValues(result.Dimensions, result.Attributes)
	}
	return result
}

func profileForProduct(name string) []recognitionDimension {
	switch {
	case strings.Contains(name, "螺母"):
		return []recognitionDimension{{"螺纹直径", false}}
	case strings.Contains(name, "螺钉"), strings.Contains(name, "螺栓"), strings.Contains(name, "螺丝"):
		return []recognitionDimension{{"螺纹直径", false}, {"长度", true}, {"螺距", true}}
	case strings.Contains(name, "法兰"):
		return []recognitionDimension{{"公称通径", false}, {"连接管外径", true}}
	case strings.Contains(strings.ToUpper(name), "EPE"), strings.Contains(name, "珍珠棉"):
		return []recognitionDimension{{"宽度", true}, {"厚度", true}, {"卷长", true}}
	case strings.Contains(name, "魔术贴"), strings.Contains(name, "粘扣带"):
		return []recognitionDimension{{"宽度", true}, {"颜色", false}, {"勾毛面", false}}
	case strings.Contains(name, "包边带"):
		return []recognitionDimension{{"宽度", true}, {"纱线规格标识", false}, {"颜色", false}}
	case strings.Contains(name, "管钳"):
		return []recognitionDimension{{"标称尺寸原文", true}}
	case strings.Contains(name, "内六角扳手"):
		return []recognitionDimension{{"标称规格", true}}
	case strings.Contains(name, "胶带"):
		return []recognitionDimension{{"宽度", true}, {"卷长", true}}
	case strings.Contains(name, "笔记本"):
		return []recognitionDimension{{"幅面", false}}
	default:
		return nil
	}
}

func IsGenericProductName(name string) bool {
	switch strings.TrimSpace(name) {
	case "辅料", "原料", "材料", "配件", "其他", "其它", "杂项", "耗材":
		return true
	default:
		return false
	}
}

// RecognizeLegacySpec is deliberately conservative: named dimensions require explicit source units.
func RecognizeLegacySpec(productName, raw string) Recognition {
	spec := strings.TrimSpace(raw)
	result := Recognition{Attributes: map[string]string{}}
	fail := func(code, message string) Recognition {
		result.Issues = append(result.Issues, RecognitionIssue{code, message})
		return result
	}
	if IsGenericProductName(productName) {
		return fail("GENERIC_PRODUCT_NAME", "物资名称过于宽泛，已保留为独立商品")
	}
	if spec == "" {
		return fail("SPEC_VALUE_MISSING", "原始规格为空")
	}
	if strings.Contains(spec, "填写") || strings.Contains(spec, "见备注") || strings.Contains(spec, "待定") {
		return fail("SPEC_UNRECOGNIZED", "原始规格是待补说明，需要复核")
	}
	set := func(dimensions []string, values []string) Recognition {
		result.Dimensions = dimensions
		for index, dimension := range dimensions {
			result.Attributes[dimension] = values[index]
		}
		_, result.Spec, _ = NormalizeValues(dimensions, result.Attributes)
		return result
	}
	if strings.Contains(productName, "纸箱") || strings.Contains(productName, "箱子") {
		parts := boxPattern.FindStringSubmatch(spec)
		if parts == nil {
			return fail("SPEC_UNRECOGNIZED", "纸箱规格无法确定长、宽、高")
		}
		if parts[4] == "" {
			return fail("DIMENSION_UNIT_MISSING", "纸箱长、宽、高缺少明确单位")
		}
		unit := strings.ToLower(parts[4])
		return set([]string{"长度", "宽度", "高度"}, []string{parts[1] + unit, parts[2] + unit, parts[3] + unit})
	}
	if strings.Contains(productName, "包边带") {
		width, yarn, color := widthPattern.FindString(spec), yarnPattern.FindString(spec), legacyColor(spec)
		if width == "" {
			return fail("DIMENSION_UNIT_MISSING", "包边带宽度缺少明确单位")
		}
		if yarn == "" || color == "" {
			return fail("SPEC_VALUE_MISSING", "包边带缺少纱线规格标识或颜色")
		}
		return set([]string{"宽度", "纱线规格标识", "颜色"}, []string{strings.ToLower(strings.ReplaceAll(width, " ", "")), strings.ToUpper(yarn), color})
	}
	if strings.Contains(productName, "魔术贴") || strings.Contains(productName, "粘扣带") {
		width, color, face := widthPattern.FindString(spec), legacyColor(spec), ""
		if strings.Contains(spec, "勾面") || strings.Contains(spec, "钩面") {
			face = "勾面"
		}
		if strings.Contains(spec, "毛面") {
			if face != "" {
				return fail("SPEC_AMBIGUOUS", "勾面和毛面同时出现，无法确定实际SKU")
			}
			face = "毛面"
		}
		if width == "" {
			return fail("DIMENSION_UNIT_MISSING", "魔术贴宽度缺少明确单位")
		}
		if color == "" || face == "" {
			return fail("SPEC_VALUE_MISSING", "魔术贴缺少颜色或勾毛面")
		}
		return set([]string{"宽度", "颜色", "勾毛面"}, []string{strings.ToLower(strings.ReplaceAll(width, " ", "")), color, face})
	}
	if strings.Contains(productName, "轴承") && bearingPattern.MatchString(spec) {
		return set([]string{"型号"}, []string{spec})
	}
	if connectorModelPattern.MatchString(spec) || metricNominalPattern.MatchString(spec) || (modelPattern.MatchString(spec) && digitPattern.MatchString(spec)) {
		return set([]string{"型号"}, []string{spec})
	}
	if unknownDimensionPattern.MatchString(spec) {
		if !lengthUnitPattern.MatchString(spec) {
			return fail("DIMENSION_UNIT_MISSING", "尺寸组合缺少明确单位，未推断尺寸含义")
		}
		return fail("SPEC_AMBIGUOUS", "尺寸组合的属性含义不明确，需要复核")
	}
	if strings.Contains(productName, "管钳") && measurePattern.MatchString(spec) {
		return set([]string{"标称尺寸原文"}, []string{spec})
	}
	if strings.Contains(productName, "内六角") && measurePattern.MatchString(spec) {
		return set([]string{"标称规格"}, []string{spec})
	}
	if (strings.Contains(productName, "聚丙烯") || strings.Contains(productName, "聚乙烯")) && polymerModelPattern.MatchString(spec) {
		return set([]string{"型号"}, []string{spec})
	}
	return fail("SPEC_UNRECOGNIZED", "原始规格无法可靠识别为最多三级规格，已保留原文")
}

func legacyColor(spec string) string {
	for _, color := range []string{"黑", "白", "红", "蓝", "绿", "黄", "灰", "透明"} {
		if strings.Contains(spec, color) {
			if color == "透明" {
				return color
			}
			return color + "色"
		}
	}
	return ""
}

func canonicalLengthUnit(unit string) string {
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case "mm", "毫米":
		return "mm"
	case "cm", "厘米":
		return "cm"
	case "m", "米":
		return "m"
	case "um", "μm":
		return "um"
	case "in", "inch", "英寸":
		return "in"
	default:
		return strings.ToLower(strings.TrimSpace(unit))
	}
}
