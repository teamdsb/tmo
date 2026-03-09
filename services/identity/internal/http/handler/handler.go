package handler

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/teamdsb/tmo/services/identity/internal/config"
	"github.com/teamdsb/tmo/services/identity/internal/auth"
	"github.com/teamdsb/tmo/services/identity/internal/db"
	"github.com/teamdsb/tmo/services/identity/internal/platform"
)

type Handler struct {
	Config   config.Config
	DB       *pgxpool.Pool
	Logger   *slog.Logger
	Auth     *auth.TokenManager
	Store    *db.Queries
	Platform *platform.MiniLoginResolver
}
