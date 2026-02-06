package inquiry

import (
	"context"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

type Store interface {
	CreatePriceInquiry(ctx context.Context, arg db.CreatePriceInquiryParams) (db.PriceInquiry, error)
	UpdatePriceInquiry(ctx context.Context, arg db.UpdatePriceInquiryParams) (db.PriceInquiry, error)
	GetPriceInquiry(ctx context.Context, id uuid.UUID) (db.PriceInquiry, error)
	ListPriceInquiries(ctx context.Context, arg db.ListPriceInquiriesParams) ([]db.PriceInquiry, error)
	CountPriceInquiries(ctx context.Context, arg db.CountPriceInquiriesParams) (int64, error)
	CreateInquiryMessage(ctx context.Context, arg db.CreateInquiryMessageParams) (db.InquiryMessage, error)
	ListInquiryMessages(ctx context.Context, arg db.ListInquiryMessagesParams) ([]db.InquiryMessage, error)
	CountInquiryMessages(ctx context.Context, inquiryID uuid.UUID) (int64, error)
}
