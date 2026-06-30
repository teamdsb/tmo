package mediaopt

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestOptimizeJPEGResizesLongEdge(t *testing.T) {
	source := image.NewNRGBA(image.Rect(0, 0, 2400, 1800))
	for y := 0; y < 1800; y++ {
		for x := 0; x < 2400; x++ {
			source.SetNRGBA(x, y, color.NRGBA{R: uint8(x), G: uint8(y), B: 90, A: 255})
		}
	}
	var input bytes.Buffer
	if err := jpeg.Encode(&input, source, &jpeg.Options{Quality: 96}); err != nil {
		t.Fatal(err)
	}
	result, err := Optimize(input.Bytes(), "image/jpeg", 1600)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := jpeg.Decode(bytes.NewReader(result.Data))
	if err != nil {
		t.Fatal(err)
	}
	if got := decoded.Bounds().Dx(); got != 1600 {
		t.Fatalf("expected width 1600, got %d", got)
	}
	if got := decoded.Bounds().Dy(); got != 1200 {
		t.Fatalf("expected height 1200, got %d", got)
	}
	if len(result.Data) >= input.Len() {
		t.Fatalf("expected optimized image smaller than input: input=%d output=%d", input.Len(), len(result.Data))
	}
}

func TestOptimizePNGPreservesAlphaAndDoesNotUpscale(t *testing.T) {
	source := image.NewNRGBA(image.Rect(0, 0, 20, 10))
	source.SetNRGBA(3, 4, color.NRGBA{R: 10, G: 20, B: 30, A: 40})
	var input bytes.Buffer
	if err := png.Encode(&input, source); err != nil {
		t.Fatal(err)
	}
	result, err := Optimize(input.Bytes(), "image/png", 1600)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := png.Decode(bytes.NewReader(result.Data))
	if err != nil {
		t.Fatal(err)
	}
	if decoded.Bounds().Dx() != 20 || decoded.Bounds().Dy() != 10 {
		t.Fatalf("small image was resized: %v", decoded.Bounds())
	}
	_, _, _, alpha := decoded.At(3, 4).RGBA()
	if alpha == 0 || alpha == 0xffff {
		t.Fatalf("expected partial alpha, got %d", alpha)
	}
}

func TestOptimizeRejectsInvalidImage(t *testing.T) {
	if _, err := Optimize([]byte("not an image"), "image/jpeg", 1600); err == nil {
		t.Fatal("expected invalid image error")
	}
}

func TestWriteAtomicallyLeavesNoTemporaryFiles(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "image.jpg")
	if err := WriteAtomically(target, []byte("new")); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(target)
	if err != nil || string(data) != "new" {
		t.Fatalf("unexpected target: data=%q err=%v", data, err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected only target file, got %d entries", len(entries))
	}
}
