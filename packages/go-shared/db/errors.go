package db

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

const uniqueViolationCode = "23505"

// IsUniqueViolation reports whether err is a Postgres unique-constraint violation.
func IsUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == uniqueViolationCode
	}
	return false
}
