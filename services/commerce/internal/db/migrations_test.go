package db

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestIncrementalAddColumnMigrationsAreReplaySafe(t *testing.T) {
	matches, err := filepath.Glob(filepath.Join("..", "..", "migrations", "*.sql"))
	if err != nil {
		t.Fatalf("list migrations: %v", err)
	}

	addColumn := regexp.MustCompile(`(?i)\bADD\s+COLUMN\b`)
	replaySafeAddColumn := regexp.MustCompile(`(?i)\bADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b`)
	for _, path := range matches {
		content, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		upSQL := extractGooseUp(string(content))
		for _, line := range strings.Split(upSQL, "\n") {
			if addColumn.MatchString(line) && !replaySafeAddColumn.MatchString(line) {
				t.Errorf("%s contains a non-replay-safe ADD COLUMN: %s", filepath.Base(path), strings.TrimSpace(line))
			}
		}
	}
}
