package handler

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/cart"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/catalog"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/order"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/tracking"
)

type Handler struct {
	CatalogStore  catalog.Store
	CartStore     cart.Store
	OrderStore    order.Store
	TrackingStore tracking.Store
	DB            *pgxpool.Pool
	Auth          *middleware.Authenticator
	Logger        *slog.Logger
}
