package handler

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

func timeFromTimestamptz(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	out := value.Time
	return &out
}
