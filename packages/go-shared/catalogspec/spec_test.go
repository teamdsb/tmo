package catalogspec

import "testing"

func TestSpecificationRules(t *testing.T) {
	for _, names := range [][]string{{"a", "b", "c", "d"}, {"a", " "}, {"a", " a "}} {
		if _, err := NormalizeDimensions(names); err == nil {
			t.Fatalf("accepted invalid dimensions %v", names)
		}
	}
	attrs, spec, err := NormalizeValues([]string{"材质", "长度", "直径"}, map[string]string{"材质": " 钢 ", "长度": "20", "直径": "6", "备注": "保留"})
	if err != nil || spec != "钢 / 20 / 6" || attrs["备注"] != "保留" {
		t.Fatalf("%v %q %v", attrs, spec, err)
	}
	if _, _, err := NormalizeValues([]string{"材质"}, nil); err == nil {
		t.Fatal("accepted missing value")
	}
	rows := []Variant{{Active: true, Attributes: map[string]string{"a": "x"}}, {Active: true, Attributes: map[string]string{"a": " x "}}}
	if err := ValidateCombinations([]string{"a"}, rows); err == nil {
		t.Fatal("accepted duplicate")
	}
	rows[1].Active = false
	if err := ValidateCombinations([]string{"a"}, rows); err != nil {
		t.Fatal(err)
	}
	// Delimiters in values must not cause false duplicate combinations.
	rows = []Variant{{Active: true, Attributes: map[string]string{"a": "x / y", "b": "z"}}, {Active: true, Attributes: map[string]string{"a": "x", "b": "y / z"}}}
	if err := ValidateCombinations([]string{"a", "b"}, rows); err != nil {
		t.Fatal(err)
	}
}

func TestLegacyCombinationsUseSpecThenName(t *testing.T) {
	rows := []Variant{{Active: true, Name: "A", Spec: "same"}, {Active: true, Name: "same"}}
	if err := ValidateCombinations(nil, rows); err == nil {
		t.Fatal("legacy duplicate accepted")
	}
	rows[1].Name = "different"
	if err := ValidateCombinations(nil, rows); err != nil {
		t.Fatal(err)
	}
}
