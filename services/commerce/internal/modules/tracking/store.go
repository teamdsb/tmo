package tracking

import (
	"context"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

type Store interface {
	UpsertTrackingShipment(ctx context.Context, arg db.UpsertTrackingShipmentParams) (db.OrderTrackingShipment, error)
	ListTrackingShipments(ctx context.Context, orderID uuid.UUID) ([]db.OrderTrackingShipment, error)
	CreateImportJob(ctx context.Context, arg db.CreateImportJobParams) (db.ImportJob, error)
	GetImportJob(ctx context.Context, id uuid.UUID) (db.ImportJob, error)
}
