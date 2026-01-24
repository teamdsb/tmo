package handler

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/teamdsb/tmo/services/identity/internal/auth"
	"github.com/teamdsb/tmo/services/identity/internal/db"
	"github.com/teamdsb/tmo/services/identity/internal/platform"
)

type Handler struct {
	DB       *pgxpool.Pool
	Logger   *slog.Logger
	Auth     *auth.TokenManager
	Store    *db.Queries
	Platform *platform.MiniLoginResolver
}
