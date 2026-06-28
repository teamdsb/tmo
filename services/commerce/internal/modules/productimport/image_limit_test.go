package productimport

import (
	"fmt"
	"strings"
	"testing"
)

func TestImageResolverAllowsNineUniqueProductImages(t *testing.T) {
	resolver := &imageResolver{}
	cover, images, err := resolver.ResolveGroup("https://example.com/import-1.jpg", productImportImageURLs(9))

	if err != nil {
		t.Fatalf("resolve nine images: %v", err)
	}
	if cover == nil || *cover != "https://example.com/import-1.jpg" {
		t.Fatalf("unexpected cover: %#v", cover)
	}
	if len(images) != 9 {
		t.Fatalf("expected 9 images, got %d", len(images))
	}
}

func TestImageResolverRejectsMoreThanNineUniqueProductImages(t *testing.T) {
	resolver := &imageResolver{}
	_, _, err := resolver.ResolveGroup("", productImportImageURLs(10))

	if err == nil || !strings.Contains(err.Error(), "at most 9 images") {
		t.Fatalf("expected image limit error, got %v", err)
	}
}

func productImportImageURLs(count int) []string {
	images := make([]string, count)
	for index := range images {
		images[index] = fmt.Sprintf("https://example.com/import-%d.jpg", index+1)
	}
	return images
}
