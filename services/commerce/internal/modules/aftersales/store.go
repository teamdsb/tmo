package aftersales

import (
	"context"

	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

type Store interface {
	CreateAfterSalesTicket(ctx context.Context, arg db.CreateAfterSalesTicketParams) (db.AfterSalesTicket, error)
	ListAfterSalesTickets(ctx context.Context, arg db.ListAfterSalesTicketsParams) ([]db.AfterSalesTicket, error)
	CountAfterSalesTickets(ctx context.Context, arg db.CountAfterSalesTicketsParams) (int64, error)
	GetAfterSalesTicket(ctx context.Context, id uuid.UUID) (db.AfterSalesTicket, error)
	UpdateAfterSalesTicket(ctx context.Context, arg db.UpdateAfterSalesTicketParams) (db.AfterSalesTicket, error)
	CreateAfterSalesMessage(ctx context.Context, arg db.CreateAfterSalesMessageParams) (db.AfterSalesMessage, error)
	ListAfterSalesMessages(ctx context.Context, arg db.ListAfterSalesMessagesParams) ([]db.AfterSalesMessage, error)
	CountAfterSalesMessages(ctx context.Context, ticketID uuid.UUID) (int64, error)
}
