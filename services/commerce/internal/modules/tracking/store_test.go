package tracking

import "github.com/teamdsb/tmo/services/commerce/internal/db"

// Assert the generated queries implement the store contract at compile time.
var _ Store = (*db.Queries)(nil)
