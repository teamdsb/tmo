package productexport

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/excel"
)

func TestExportRowPreservesUnsafeAttributesAndOriginalImages(t *testing.T) {
	cover := "https://example.com/raw.png?token=a&b=c"
	unit := "盒"
	spec := "old legacy display"
	maxQty := int32(9)
	product := db.CatalogProduct{ID: uuid.New(), Name: "Bolt", CategoryID: uuid.New(), Status: "ACTIVE", CoverImageUrl: &cover, Images: []string{cover}, FilterDimensions: []string{"材质", "长度", "直径"}, Tags: []string{"a|b"}}
	sku := db.CatalogSku{ID: uuid.New(), Name: "Bolt SKU", Spec: &spec, Unit: &unit, IsActive: false, Attributes: []byte(`{"材质":"钢|铝","长度":"10:mm","直径":"M6","备注":"a:b|c"}`)}
	values := exportRowValues(product, &sku, []db.CatalogPriceTier{{MinQty: 1, MaxQty: &maxQty, UnitPriceFen: 1200}, {MinQty: 10, UnitPriceFen: 1000}})
	fields := map[string]string{}
	for i, col := range excel.ProductImportTemplate().Columns {
		fields[col.Key] = values[i]
	}
	if fields["spec"] != "钢|铝 / 10:mm / M6" || fields["spec3value"] != "M6" || fields["coverimage"] != cover || fields["isactive"] != "false" || fields["pricetiers"] != "1-9:1200|10-:1000" {
		t.Fatal(fields)
	}
	attrs := map[string]string{}
	if err := json.Unmarshal([]byte(fields["attributes"]), &attrs); err != nil || attrs["备注"] != "a:b|c" {
		t.Fatal(attrs, err)
	}
	if fields["skuid"] != sku.ID.String() || fields["productid"] != product.ID.String() {
		t.Fatal("missing stable IDs")
	}
}

func TestExportProductOnlyAndLegacyRows(t *testing.T) {
	product := db.CatalogProduct{ID: uuid.New(), Name: "Product", CategoryID: uuid.New(), Status: "DRAFT"}
	for _, sku := range []*db.CatalogSku{nil, {ID: uuid.New(), Name: "Legacy SKU", IsActive: true, Attributes: []byte(`{}`)}} {
		row := exportRowValues(product, sku, nil)
		fields := map[string]string{}
		for i, col := range excel.ProductImportTemplate().Columns {
			fields[col.Key] = row[i]
		}
		if fields["images"] != "" || fields["tags"] != "" {
			t.Fatal("nil metadata must export empty fields")
		}
		if sku == nil {
			if fields["skuname"] != "" || fields["skuid"] != "" || fields["isactive"] != "" || fields["spec1name"] != "" {
				t.Fatal(fields)
			}
		} else if fields["spec1name"] != "规格" || fields["spec1value"] != "Legacy SKU" {
			t.Fatal(fields)
		}
	}
}

func TestWorkbookCanBeServedBySeparateNginxUser(t *testing.T) {
	dir := t.TempDir()
	id := uuid.New()
	service := NewService(nil, dir, "https://example.com/assets/media")
	if _, err := service.writeWorkbook(id, nil); err != nil {
		t.Fatal(err)
	}
	for _, relative := range []string{"import-jobs", filepath.Join("import-jobs", id.String()), filepath.Join("import-jobs", id.String(), "exports")} {
		info, err := os.Stat(filepath.Join(dir, relative))
		if err != nil {
			t.Fatal(err)
		}
		if info.Mode().Perm()&0o005 != 0o005 {
			t.Fatalf("Nginx cannot traverse/read %s: %v", relative, info.Mode())
		}
	}
	info, err := os.Stat(filepath.Join(dir, "import-jobs", id.String(), "exports", exportFileName))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm()&0o004 == 0 {
		t.Fatalf("Nginx cannot read workbook: %v", info.Mode())
	}
}
