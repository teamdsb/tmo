package cart

import (
	"testing"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

func TestQueriesImplementsStore(test *testing.T) {
	var store Store = (*db.Queries)(nil)
	if store == nil {
		test.Fatal("expected store interface to be non-nil")
	}
}
