package mediaopt

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"
)

func TestOptimizeProductDirectoryDryRunAndApply(t *testing.T) {
	productDir := filepath.Join(t.TempDir(), "catalog", "products")
	backupDir := filepath.Join(t.TempDir(), "backup")
	if err := os.MkdirAll(productDir, 0o755); err != nil {
		t.Fatal(err)
	}
	imagePath := filepath.Join(productDir, "large.jpg")
	file, err := os.Create(imagePath)
	if err != nil {
		t.Fatal(err)
	}
	source := image.NewNRGBA(image.Rect(0, 0, 1800, 1200))
	for y := 0; y < 1200; y++ {
		for x := 0; x < 1800; x++ {
			source.SetNRGBA(x, y, color.NRGBA{R: uint8(x), G: uint8(y), B: 100, A: 255})
		}
	}
	if err := jpeg.Encode(file, source, &jpeg.Options{Quality: 96}); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	original, _ := os.ReadFile(imagePath)

	dryRun, err := OptimizeProductDirectory(productDir, backupDir, false)
	if err != nil {
		t.Fatal(err)
	}
	if dryRun.Candidates != 1 || dryRun.Updated != 0 {
		t.Fatalf("unexpected dry-run report: %+v", dryRun)
	}
	unchanged, _ := os.ReadFile(imagePath)
	if string(unchanged) != string(original) {
		t.Fatal("dry-run modified source file")
	}

	applied, err := OptimizeProductDirectory(productDir, backupDir, true)
	if err != nil {
		t.Fatal(err)
	}
	if applied.Updated != 1 {
		t.Fatalf("unexpected apply report: %+v", applied)
	}
	if _, err := os.Stat(filepath.Join(backupDir, "large.jpg")); err != nil {
		t.Fatalf("backup missing: %v", err)
	}
	optimized, _ := os.ReadFile(imagePath)
	config, err := jpeg.DecodeConfig(bytes.NewReader(optimized))
	if err != nil {
		t.Fatal(err)
	}
	if config.Width != 1600 || config.Height != 1067 {
		t.Fatalf("unexpected optimized dimensions: %dx%d", config.Width, config.Height)
	}
}
