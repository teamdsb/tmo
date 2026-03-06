package excel

import "testing"

func TestNormalizeHeaderKeyStripsPunctuation(t *testing.T) {
	testCases := map[string]string{
		"Price Tiers (Fen)": "pricetiersfen",
		"Group-Key":         "groupkey",
		"SKU_Code":          "skucode",
		" images / urls ":   "imagesurls",
	}

	for input, want := range testCases {
		if got := NormalizeHeaderKey(input); got != want {
			t.Fatalf("NormalizeHeaderKey(%q) = %q, want %q", input, got, want)
		}
	}
}
