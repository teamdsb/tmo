// Package catalogspec defines the ordered, at-most-three-level SKU specification rules.
package catalogspec

import (
	"encoding/json"
	"fmt"
	"strings"
)

const MaxDimensions = 3

type Variant struct {
	ID         string
	Name       string
	Spec       string
	Attributes map[string]string
	Active     bool
}

func NormalizeDimensions(dimensions []string) ([]string, error) {
	if len(dimensions) > MaxDimensions {
		return nil, fmt.Errorf("specifications support at most 3 levels")
	}
	result := make([]string, len(dimensions))
	seen := map[string]bool{}
	for i, name := range dimensions {
		name = strings.TrimSpace(name)
		if name == "" {
			return nil, fmt.Errorf("specification level %d name is required", i+1)
		}
		if seen[name] {
			return nil, fmt.Errorf("duplicate specification name %q", name)
		}
		seen[name] = true
		result[i] = name
	}
	return result, nil
}

// NormalizeValues copies extension attributes and normalizes only specification values.
func NormalizeValues(dimensions []string, attributes map[string]string) (map[string]string, string, error) {
	dims, err := NormalizeDimensions(dimensions)
	if err != nil {
		return nil, "", err
	}
	attrs := make(map[string]string, len(attributes))
	for key, value := range attributes {
		attrs[key] = value
	}
	values := make([]string, len(dims))
	for i, name := range dims {
		value := strings.TrimSpace(attrs[name])
		if value == "" {
			return nil, "", fmt.Errorf("specification %q value is required", name)
		}
		attrs[name] = value
		values[i] = value
	}
	return attrs, strings.Join(values, " / "), nil
}

// ValidateCombinations allows historical inactive variants but requires active paths to be unique.
func ValidateCombinations(dimensions []string, rows []Variant) error {
	dims, err := NormalizeDimensions(dimensions)
	if err != nil {
		return err
	}
	seen := map[string]int{}
	for i, row := range rows {
		if !row.Active {
			continue
		}
		values := []string{}
		if len(dims) == 0 {
			value := strings.TrimSpace(row.Spec)
			if value == "" {
				value = strings.TrimSpace(row.Name)
			}
			if value == "" {
				return fmt.Errorf("SKU row %d: specification value is required", i+1)
			}
			values = append(values, value)
		} else {
			attrs, _, err := NormalizeValues(dims, row.Attributes)
			if err != nil {
				return fmt.Errorf("SKU row %d: %w", i+1, err)
			}
			for _, name := range dims {
				values = append(values, attrs[name])
			}
		}
		key, _ := json.Marshal(values)
		if previous, ok := seen[string(key)]; ok {
			return fmt.Errorf("duplicate specification combination in SKU rows %d and %d", previous, i+1)
		}
		seen[string(key)] = i + 1
	}
	return nil
}
