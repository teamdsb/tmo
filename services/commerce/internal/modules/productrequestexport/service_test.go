package productrequestexport

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/excel"
)

func TestExportRowValuesFormatsOptionalFields(t *testing.T) {
	createdBy := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	ownerSales := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	categoryID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	createdAt := time.Date(2026, 3, 6, 8, 30, 0, 0, time.UTC)
	updatedAt := createdAt.Add(15 * time.Minute)

	rows := exportRowValues(db.ProductRequest{
		ID:                 uuid.MustParse("44444444-4444-4444-4444-444444444444"),
		CreatedByUserID:    createdBy,
		OwnerSalesUserID:   pgtype.UUID{Bytes: ownerSales, Valid: true},
		Name:               "Need custom bracket",
		CategoryID:         pgtype.UUID{Bytes: categoryID, Valid: true},
		Spec:               stringPtr("grade A"),
		Material:           stringPtr("stainless steel"),
		Dimensions:         stringPtr("100x50x2"),
		Color:              stringPtr("silver"),
		Qty:                stringPtr("10 pcs"),
		Note:               stringPtr("urgent"),
		ReferenceImageUrls: []string{"https://example.com/a.png", "https://example.com/b.png"},
		CreatedAt:          pgtype.Timestamptz{Time: createdAt, Valid: true},
		UpdatedAt:          pgtype.Timestamptz{Time: updatedAt, Valid: true},
	})

	expected := []string{
		"44444444-4444-4444-4444-444444444444",
		"11111111-1111-1111-1111-111111111111",
		"22222222-2222-2222-2222-222222222222",
		"Need custom bracket",
		"33333333-3333-3333-3333-333333333333",
		"grade A",
		"stainless steel",
		"100x50x2",
		"silver",
		"10 pcs",
		"urgent",
		"https://example.com/a.png | https://example.com/b.png",
		"2026-03-06T08:30:00Z",
		"2026-03-06T08:45:00Z",
	}

	if len(rows) != len(expected) {
		t.Fatalf("expected %d cells, got %d", len(expected), len(rows))
	}
	for index, want := range expected {
		if rows[index] != want {
			t.Fatalf("expected cell %d=%q, got %q", index, want, rows[index])
		}
	}
}

func TestExportRowValuesFormatsEmptyOptionals(t *testing.T) {
	rows := exportRowValues(db.ProductRequest{
		ID:                 uuid.MustParse("55555555-5555-5555-5555-555555555555"),
		CreatedByUserID:    uuid.MustParse("66666666-6666-6666-6666-666666666666"),
		Name:               "Need plain part",
		OwnerSalesUserID:   pgtype.UUID{},
		CategoryID:         pgtype.UUID{},
		ReferenceImageUrls: []string{},
		CreatedAt:          pgtype.Timestamptz{},
		UpdatedAt:          pgtype.Timestamptz{},
	})

	for _, index := range []int{2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13} {
		if rows[index] != "" {
			t.Fatalf("expected cell %d to be empty, got %q", index, rows[index])
		}
	}
}

func TestWriteWorkbookCreatesHeaderOnlyFile(t *testing.T) {
	mediaDir := t.TempDir()
	service := NewService(nil, mediaDir, testMediaBaseURL)
	jobID := uuid.MustParse("77777777-7777-7777-7777-777777777777")

	resultURL, err := service.writeWorkbook(jobID, nil)
	if err != nil {
		t.Fatalf("write workbook: %v", err)
	}
	expectedURL := testMediaBaseURL + "/import-jobs/77777777-7777-7777-7777-777777777777/exports/" + exportFileName
	if resultURL != expectedURL {
		t.Fatalf("expected result URL %q, got %q", expectedURL, resultURL)
	}

	rows := readExportWorkbookRows(t, mediaDir, resultURL)
	if len(rows) != 1 {
		t.Fatalf("expected header-only workbook, got %d rows", len(rows))
	}
	headers := excel.TemplateHeaders(excel.ProductRequestExportTemplate())
	if len(rows[0]) != len(headers) {
		t.Fatalf("expected %d headers, got %d", len(headers), len(rows[0]))
	}

	expectedPath := filepath.Join(mediaDir, "import-jobs", jobID.String(), "exports", exportFileName)
	if _, err := os.Stat(expectedPath); err != nil {
		t.Fatalf("expected workbook to exist at %s: %v", expectedPath, err)
	}
}

func TestToPgTimestampNormalizesUTC(t *testing.T) {
	localZone := time.FixedZone("UTC+8", 8*60*60)
	value := time.Date(2026, 3, 6, 18, 0, 0, 0, localZone)
	got := toPgTimestamp(&value)

	if !got.Valid {
		t.Fatalf("expected timestamp to be valid")
	}
	if got.Time.Location() != time.UTC {
		t.Fatalf("expected UTC location, got %v", got.Time.Location())
	}
	if got.Time.Format(time.RFC3339) != "2026-03-06T10:00:00Z" {
		t.Fatalf("unexpected UTC time: %s", got.Time.Format(time.RFC3339))
	}
}
