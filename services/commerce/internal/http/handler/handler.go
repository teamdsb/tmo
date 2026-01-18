package handler

import (
	"log/slog"

	"github.com/teamdsb/tmo/services/commerce/internal/catalog"
)

type Handler struct {
	Store  catalog.Store
	Logger *slog.Logger
}
