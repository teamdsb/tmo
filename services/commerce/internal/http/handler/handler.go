package handler

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/aftersales"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/cart"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/catalog"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/inquiry"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/order"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/productrequest"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/tracking"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/wishlist"
)

type Handler struct {
	CatalogStore        catalog.Store
	CartStore           cart.Store
	OrderStore          order.Store
	TrackingStore       tracking.Store
	WishlistStore       wishlist.Store
	ProductRequestStore productrequest.Store
	AfterSalesStore     aftersales.Store
	InquiryStore        inquiry.Store
	MediaLocalOutputDir string
	MediaPublicBaseURL  string
	DB                  *pgxpool.Pool
	Auth                *middleware.Authenticator
	Logger              *slog.Logger
}
