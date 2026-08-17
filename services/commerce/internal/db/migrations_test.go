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

func TestSupportQueueTimestampBackfillOnlyFillsMissingValues(t *testing.T) {
	path := filepath.Join("..", "..", "migrations", "00023_add_support_queue_timestamps.sql")
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read support queue migration: %v", err)
	}
	upSQL := extractGooseUp(string(content))

	for _, guard := range []string{"WHERE queued_at IS NULL", "AND assigned_at IS NULL"} {
		if !strings.Contains(upSQL, guard) {
			t.Errorf("support queue migration must preserve existing timestamps with %q", guard)
		}
	}
}

func TestReleaseSupportConversationUsesAssigneeCompareAndSwap(t *testing.T) {
	path := filepath.Join("..", "..", "queries", "support.sql")
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read support queries: %v", err)
	}
	query := string(content)
	start := strings.Index(query, "-- name: ReleaseSupportConversation :one")
	if start < 0 {
		t.Fatal("ReleaseSupportConversation query is missing")
	}
	end := strings.Index(query[start+1:], "-- name:")
	if end >= 0 {
		query = query[start : start+1+end]
	} else {
		query = query[start:]
	}
	if !strings.Contains(query, "expected_assignee_user_id") {
		t.Fatal("ReleaseSupportConversation must compare the expected assignee before clearing ownership")
	}
}
