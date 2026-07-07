package mediaopt

import (
	"bytes"
	"fmt"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"strings"
)

type DirectoryReport struct {
	Scanned     int
	Candidates  int
	Updated     int
	BytesBefore int64
	BytesAfter  int64
}

func OptimizeProductDirectory(productDir, backupDir string, apply bool) (DirectoryReport, error) {
	report := DirectoryReport{}
	entries, err := os.ReadDir(productDir)
	if err != nil {
		return report, err
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(entry.Name()))
		contentType := ""
		switch ext {
		case ".jpg", ".jpeg":
			contentType = "image/jpeg"
		case ".png":
			contentType = "image/png"
		default:
			continue
		}
		report.Scanned++
		path := filepath.Join(productDir, entry.Name())
		original, err := os.ReadFile(path)
		if err != nil {
			return report, fmt.Errorf("read %s: %w", path, err)
		}
		optimized, err := Optimize(original, contentType, DefaultMaxDimension)
		if err != nil {
			return report, fmt.Errorf("optimize %s: %w", path, err)
		}
		originalWidth, originalHeight, err := imageDimensions(original, contentType)
		if err != nil {
			return report, fmt.Errorf("inspect %s: %w", path, err)
		}
		needsResize := originalWidth > DefaultMaxDimension || originalHeight > DefaultMaxDimension
		minimumSavings := len(original) / 100
		if minimumSavings < 1024 {
			minimumSavings = 1024
		}
		if !needsResize && len(original)-len(optimized.Data) < minimumSavings {
			continue
		}
		report.Candidates++
		report.BytesBefore += int64(len(original))
		report.BytesAfter += int64(len(optimized.Data))
		if !apply {
			continue
		}
		if strings.TrimSpace(backupDir) == "" {
			return report, fmt.Errorf("backup directory is required when apply is enabled")
		}
		if err := os.MkdirAll(backupDir, 0o755); err != nil {
			return report, err
		}
		if err := WriteAtomically(filepath.Join(backupDir, entry.Name()), original); err != nil {
			return report, fmt.Errorf("backup %s: %w", path, err)
		}
		if err := WriteAtomically(path, optimized.Data); err != nil {
			return report, fmt.Errorf("replace %s: %w", path, err)
		}
		report.Updated++
	}
	return report, nil
}

func imageDimensions(data []byte, contentType string) (int, int, error) {
	var width, height int
	if contentType == "image/png" {
		config, err := png.DecodeConfig(bytes.NewReader(data))
		if err != nil {
			return 0, 0, err
		}
		width, height = config.Width, config.Height
	} else {
		config, err := jpeg.DecodeConfig(bytes.NewReader(data))
		if err != nil {
			return 0, 0, err
		}
		width, height = config.Width, config.Height
	}
	return width, height, nil
}
