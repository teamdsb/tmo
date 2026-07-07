package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/teamdsb/tmo/services/commerce/internal/mediaopt"
)

func main() {
	mediaRoot := flag.String("media-root", "./var/media", "media root containing catalog/products")
	backupDir := flag.String("backup-dir", "", "backup directory used with --apply")
	apply := flag.Bool("apply", false, "write optimized images after backing up originals")
	flag.Parse()

	productsDir := filepath.Join(*mediaRoot, "catalog", "products")
	resolvedBackup := *backupDir
	if *apply && resolvedBackup == "" {
		resolvedBackup = filepath.Join(*mediaRoot, fmt.Sprintf("catalog-products-backup-%s", time.Now().UTC().Format("20060102T150405Z")))
	}
	report, err := mediaopt.OptimizeProductDirectory(productsDir, resolvedBackup, *apply)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("mode=%s scanned=%d candidates=%d updated=%d bytes_before=%d bytes_after=%d backup=%s\n",
		map[bool]string{true: "apply", false: "dry-run"}[*apply], report.Scanned, report.Candidates,
		report.Updated, report.BytesBefore, report.BytesAfter, resolvedBackup)
}
