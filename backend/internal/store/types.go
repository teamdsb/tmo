package store

import (
	"time"

	"github.com/google/uuid"
)

type SalesProfile struct {
	ID        uuid.UUID
	Name      string
	BindCode  string
	CreatedAt time.Time
}

type Customer struct {
	ID        uuid.UUID
	Name      string
	Phone     string
	SalesID   *uuid.UUID
	CreatedAt time.Time
}
