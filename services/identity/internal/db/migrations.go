package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func ApplyMigrations(ctx context.Context, pool *pgxpool.Pool, migrationsDir string) error {
	pattern := filepath.Join(migrationsDir, "*.sql")
	files, err := filepath.Glob(pattern)
	if err != nil {
		return fmt.Errorf("list migrations: %w", err)
	}
	if len(files) == 0 {
		return fmt.Errorf("no migrations found")
	}

	sort.Strings(files)
	for _, path := range files {
		// #nosec G304 -- path is a fixed, repo-local migration file.
		content, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read migration: %w", err)
		}

		upSQL := extractGooseUp(string(content))
		statements := splitSQLStatements(upSQL)
		for _, statement := range statements {
			if _, err := pool.Exec(ctx, statement); err != nil {
				return fmt.Errorf("exec migration statement: %w", err)
			}
		}
	}

	return nil
}

func extractGooseUp(content string) string {
	lines := strings.Split(content, "\n")
	inUp := false
	var builder strings.Builder
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "-- +goose Up") {
			inUp = true
			continue
		}
		if strings.HasPrefix(trimmed, "-- +goose Down") {
			break
		}
		if !inUp {
			continue
		}
		if strings.HasPrefix(trimmed, "-- +goose") {
			continue
		}
		builder.WriteString(line)
		builder.WriteString("\n")
	}
	return builder.String()
}

func splitSQLStatements(sql string) []string {
	statements := make([]string, 0)
	var builder strings.Builder

	inSingle := false
	inDouble := false
	inLineComment := false
	inBlockComment := false
	inDollar := false
	dollarTag := ""

	runes := []rune(sql)
	for i := 0; i < len(runes); i++ {
		ch := runes[i]

		if inLineComment {
			builder.WriteRune(ch)
			if ch == '\n' {
				inLineComment = false
			}
			continue
		}

		if inBlockComment {
			builder.WriteRune(ch)
			if ch == '*' && i+1 < len(runes) && runes[i+1] == '/' {
				builder.WriteRune(runes[i+1])
				i++
				inBlockComment = false
			}
			continue
		}

		if inDollar {
			if ch == '$' && hasDollarTag(runes, i, dollarTag) {
				for _, tagRune := range []rune(dollarTag) {
					builder.WriteRune(tagRune)
				}
				i += len([]rune(dollarTag)) - 1
				inDollar = false
				dollarTag = ""
				continue
			}
			builder.WriteRune(ch)
			continue
		}

		if inSingle {
			builder.WriteRune(ch)
			if ch == '\'' {
				if i+1 < len(runes) && runes[i+1] == '\'' {
					builder.WriteRune(runes[i+1])
					i++
					continue
				}
				inSingle = false
			}
			continue
		}

		if inDouble {
			builder.WriteRune(ch)
			if ch == '"' {
				if i+1 < len(runes) && runes[i+1] == '"' {
					builder.WriteRune(runes[i+1])
					i++
					continue
				}
				inDouble = false
			}
			continue
		}

		if ch == '-' && i+1 < len(runes) && runes[i+1] == '-' {
			builder.WriteRune(ch)
			builder.WriteRune(runes[i+1])
			i++
			inLineComment = true
			continue
		}
		if ch == '/' && i+1 < len(runes) && runes[i+1] == '*' {
			builder.WriteRune(ch)
			builder.WriteRune(runes[i+1])
			i++
			inBlockComment = true
			continue
		}
		if ch == '\'' {
			builder.WriteRune(ch)
			inSingle = true
			continue
		}
		if ch == '"' {
			builder.WriteRune(ch)
			inDouble = true
			continue
		}
		if ch == '$' {
			if tag, ok := parseDollarTag(runes, i); ok {
				builder.WriteString(tag)
				i += len([]rune(tag)) - 1
				inDollar = true
				dollarTag = tag
				continue
			}
		}

		if ch == ';' {
			statement := strings.TrimSpace(builder.String())
			if statement != "" {
				statements = append(statements, statement)
			}
			builder.Reset()
			continue
		}

		builder.WriteRune(ch)
	}

	tail := strings.TrimSpace(builder.String())
	if tail != "" {
		statements = append(statements, tail)
	}

	return statements
}

func parseDollarTag(runes []rune, start int) (string, bool) {
	if runes[start] != '$' {
		return "", false
	}
	for j := start + 1; j < len(runes); j++ {
		if runes[j] == '$' {
			tag := string(runes[start : j+1])
			return tag, isDollarTag(tag)
		}
		if !(runes[j] == '_' || runes[j] >= '0' && runes[j] <= '9' || runes[j] >= 'A' && runes[j] <= 'Z' || runes[j] >= 'a' && runes[j] <= 'z') {
			return "", false
		}
	}
	return "", false
}

func hasDollarTag(runes []rune, start int, tag string) bool {
	if tag == "" {
		return false
	}
	tagRunes := []rune(tag)
	if start+len(tagRunes) > len(runes) {
		return false
	}
	for i := range tagRunes {
		if runes[start+i] != tagRunes[i] {
			return false
		}
	}
	return true
}

func isDollarTag(tag string) bool {
	if len(tag) < 2 || tag[0] != '$' || tag[len(tag)-1] != '$' {
		return false
	}
	if len(tag) == 2 {
		return true
	}
	for i := 1; i < len(tag)-1; i++ {
		ch := tag[i]
		if !(ch == '_' || ch >= '0' && ch <= '9' || ch >= 'A' && ch <= 'Z' || ch >= 'a' && ch <= 'z') {
			return false
		}
	}
	return true
}
