package order

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

type AutoDeliveryStore interface {
	AutoDeliverShippedOrders(ctx context.Context, arg db.AutoDeliverShippedOrdersParams) ([]db.Order, error)
}

type AutoDeliveryWorker struct {
	Store         AutoDeliveryStore
	After         time.Duration
	CheckInterval time.Duration
	Logger        *slog.Logger
}

func (w *AutoDeliveryWorker) Start(ctx context.Context) {
	if w.Store == nil {
		return
	}

	interval := w.CheckInterval
	if interval <= 0 {
		interval = time.Hour
	}
	after := w.After
	if after <= 0 {
		after = 7 * 24 * time.Hour
	}

	go func() {
		w.runOnce(ctx, after)

		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				w.runOnce(ctx, after)
			}
		}
	}()
}

func (w *AutoDeliveryWorker) runOnce(ctx context.Context, after time.Duration) {
	cutoff := time.Now().UTC().Add(-after)
	orders, err := w.Store.AutoDeliverShippedOrders(ctx, db.AutoDeliverShippedOrdersParams{
		Status:   "SHIPPED",
		Status_2: "DELIVERED",
		ShippedAt: pgtype.Timestamptz{
			Time:  cutoff,
			Valid: true,
		},
	})
	if err != nil {
		if w.Logger != nil {
			w.Logger.Error("auto delivery failed", "error", err)
		}
		return
	}
	if len(orders) > 0 && w.Logger != nil {
		w.Logger.Info("auto delivered shipped orders", "count", len(orders), "cutoff", cutoff.Format(time.RFC3339))
	}
}
