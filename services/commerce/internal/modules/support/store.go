package support

import (
	"context"

	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

type Store interface {
	CreateSupportConversation(ctx context.Context, arg db.CreateSupportConversationParams) (db.SupportConversation, error)
	GetActiveSupportConversationByCustomer(ctx context.Context, customerUserID uuid.UUID) (db.SupportConversation, error)
	GetSupportConversation(ctx context.Context, id uuid.UUID) (db.SupportConversation, error)
	ListSupportConversations(ctx context.Context, arg db.ListSupportConversationsParams) ([]db.SupportConversation, error)
	CountSupportConversations(ctx context.Context, arg db.CountSupportConversationsParams) (int64, error)
	ClaimSupportConversation(ctx context.Context, arg db.ClaimSupportConversationParams) (db.SupportConversation, error)
	ReleaseSupportConversation(ctx context.Context, id uuid.UUID) (db.SupportConversation, error)
	TransferSupportConversation(ctx context.Context, arg db.TransferSupportConversationParams) (db.SupportConversation, error)
	UpdateSupportConversationAfterMessage(ctx context.Context, arg db.UpdateSupportConversationAfterMessageParams) (db.SupportConversation, error)
	MarkSupportConversationReadForCustomer(ctx context.Context, id uuid.UUID) (db.SupportConversation, error)
	MarkSupportConversationReadForStaff(ctx context.Context, id uuid.UUID) (db.SupportConversation, error)
	CreateSupportMessageAsset(ctx context.Context, arg db.CreateSupportMessageAssetParams) (db.SupportMessageAsset, error)
	GetSupportMessageAsset(ctx context.Context, id uuid.UUID) (db.SupportMessageAsset, error)
	CreateSupportMessage(ctx context.Context, arg db.CreateSupportMessageParams) (db.SupportMessage, error)
	ListSupportMessages(ctx context.Context, arg db.ListSupportMessagesParams) ([]db.SupportMessage, error)
	CountSupportMessages(ctx context.Context, conversationID uuid.UUID) (int64, error)
	CreateSupportConversationTransfer(ctx context.Context, arg db.CreateSupportConversationTransferParams) (db.SupportConversationTransfer, error)
}
