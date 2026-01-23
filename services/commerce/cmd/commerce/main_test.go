package main

import (
	"log/slog"
	"testing"
)

func TestParseLogLevel(test *testing.T) {
	cases := []struct {
		name     string
		input    string
		expected slog.Level
	}{
		{name: "debug", input: "debug", expected: slog.LevelDebug},
		{name: "warn", input: "warn", expected: slog.LevelWarn},
		{name: "warning", input: "warning", expected: slog.LevelWarn},
		{name: "error", input: "error", expected: slog.LevelError},
		{name: "default", input: "info", expected: slog.LevelInfo},
		{name: "unknown", input: "nope", expected: slog.LevelInfo},
		{name: "case-insensitive", input: "DeBuG", expected: slog.LevelDebug},
	}

	for _, testCase := range cases {
		test.Run(testCase.name, func(runTest *testing.T) {
			level := parseLogLevel(testCase.input)
			if level != testCase.expected {
				runTest.Fatalf("expected %v, got %v", testCase.expected, level)
			}
		})
	}
}
