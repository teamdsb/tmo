package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultDSN = "postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable"

const (
	statusOpenUnassigned = "OPEN_UNASSIGNED"
	statusOpenAssigned   = "OPEN_ASSIGNED"
	statusClosed         = "CLOSED"

	senderTypeCustomer = "CUSTOMER"
	senderTypeStaff    = "STAFF"
	senderTypeSystem   = "SYSTEM"

	messageTypeText = "TEXT"
)

type priceInquiryRow struct {
	ID                  uuid.UUID
	CreatedByUserID     uuid.UUID
	OwnerSalesUserID    *uuid.UUID
	AssignedSalesUserID *uuid.UUID
	Message             string
	Status              string
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type inquiryMessageRow struct {
	ID           uuid.UUID
	InquiryID    uuid.UUID
	SenderType   string
	SenderUserID *uuid.UUID
	Content      string
	CreatedAt    time.Time
}

type supportConversationRow struct {
	ID             uuid.UUID
	CustomerUserID uuid.UUID
	AssigneeUserID *uuid.UUID
	Status         string
	ClosedAt       *time.Time
}

type stats struct {
	ConversationsCreated int
	MessagesInserted     int
	MessagesSkipped      int
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	dsn := strings.TrimSpace(os.Getenv("COMMERCE_DB_DSN"))
	if dsn == "" {
		dsn = defaultDSN
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return fmt.Errorf("connect database: %w", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping database: %w", err)
	}

	tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	inquiries, err := loadPriceInquiries(ctx, tx)
	if err != nil {
		return err
	}

	stat := stats{}
	affectedConversations := make(map[uuid.UUID]struct{})

	for _, inquiry := range inquiries {
		conversation, created, err := ensureConversation(ctx, tx, inquiry)
		if err != nil {
			return err
		}
		if created {
			stat.ConversationsCreated++
		}
		affectedConversations[conversation.ID] = struct{}{}

		inserted, err := ensureSupportTextMessage(
			ctx,
			tx,
			conversation.ID,
			senderTypeCustomer,
			ptrUUID(inquiry.CreatedByUserID),
			nil,
			strings.TrimSpace(inquiry.Message),
			inquiry.CreatedAt,
		)
		if err != nil {
			return err
		}
		if inserted {
			stat.MessagesInserted++
		} else {
			stat.MessagesSkipped++
		}

		messages, err := loadInquiryMessages(ctx, tx, inquiry.ID)
		if err != nil {
			return err
		}
		for _, message := range messages {
			senderType, senderRole := normalizeInquiryMessageSender(message)
			inserted, err := ensureSupportTextMessage(
				ctx,
				tx,
				conversation.ID,
				senderType,
				message.SenderUserID,
				senderRole,
				strings.TrimSpace(message.Content),
				message.CreatedAt,
			)
			if err != nil {
				return err
			}
			if inserted {
				stat.MessagesInserted++
			} else {
				stat.MessagesSkipped++
			}
		}
	}

	for conversationID := range affectedConversations {
		if err := refreshConversationSnapshot(ctx, tx, conversationID); err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	fmt.Printf(
		"support history backfill completed: %d conversations created, %d messages inserted, %d messages skipped\n",
		stat.ConversationsCreated,
		stat.MessagesInserted,
		stat.MessagesSkipped,
	)
	return nil
}

func loadPriceInquiries(ctx context.Context, tx pgx.Tx) ([]priceInquiryRow, error) {
	rows, err := tx.Query(ctx, `
SELECT id, created_by_user_id, owner_sales_user_id, assigned_sales_user_id, message, status, created_at, updated_at
FROM price_inquiries
ORDER BY created_by_user_id, created_at, id
`)
	if err != nil {
		return nil, fmt.Errorf("query price inquiries: %w", err)
	}
	defer rows.Close()

	items := make([]priceInquiryRow, 0)
	for rows.Next() {
		var row priceInquiryRow
		if err := rows.Scan(
			&row.ID,
			&row.CreatedByUserID,
			&row.OwnerSalesUserID,
			&row.AssignedSalesUserID,
			&row.Message,
			&row.Status,
			&row.CreatedAt,
			&row.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan price inquiry: %w", err)
		}
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate price inquiries: %w", err)
	}
	return items, nil
}

func loadInquiryMessages(ctx context.Context, tx pgx.Tx, inquiryID uuid.UUID) ([]inquiryMessageRow, error) {
	rows, err := tx.Query(ctx, `
SELECT id, inquiry_id, sender_type, sender_user_id, content, created_at
FROM inquiry_messages
WHERE inquiry_id = $1
ORDER BY created_at, id
`, inquiryID)
	if err != nil {
		return nil, fmt.Errorf("query inquiry messages %s: %w", inquiryID, err)
	}
	defer rows.Close()

	items := make([]inquiryMessageRow, 0)
	for rows.Next() {
		var row inquiryMessageRow
		if err := rows.Scan(
			&row.ID,
			&row.InquiryID,
			&row.SenderType,
			&row.SenderUserID,
			&row.Content,
			&row.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan inquiry message: %w", err)
		}
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate inquiry messages: %w", err)
	}
	return items, nil
}

func ensureConversation(ctx context.Context, tx pgx.Tx, inquiry priceInquiryRow) (supportConversationRow, bool, error) {
	var conversation supportConversationRow
	err := tx.QueryRow(ctx, `
SELECT id, customer_user_id, assignee_user_id, status, closed_at
FROM support_conversations
WHERE customer_user_id = $1
  AND closed_at IS NULL
ORDER BY created_at DESC
LIMIT 1
`, inquiry.CreatedByUserID).Scan(
		&conversation.ID,
		&conversation.CustomerUserID,
		&conversation.AssigneeUserID,
		&conversation.Status,
		&conversation.ClosedAt,
	)
	if err == nil {
		return conversation, false, nil
	}
	if err != pgx.ErrNoRows {
		return supportConversationRow{}, false, fmt.Errorf("get support conversation for customer %s: %w", inquiry.CreatedByUserID, err)
	}

	status := inferConversationStatus(inquiry)
	assigneeRole := ""
	if inquiry.AssignedSalesUserID != nil {
		assigneeRole = "SALES"
	}

	err = tx.QueryRow(ctx, `
INSERT INTO support_conversations (
  customer_user_id,
  owner_sales_user_id,
  assignee_user_id,
  assignee_role,
  status,
  last_message_type,
  last_message_preview,
  last_message_at,
  customer_unread_count,
  staff_unread_count,
  created_at,
  updated_at,
  closed_at
)
VALUES ($1, $2, $3, NULLIF($4, ''), $5, NULL, NULL, $6, 0, 0, $6, $7, $8)
RETURNING id, customer_user_id, assignee_user_id, status, closed_at
`,
		inquiry.CreatedByUserID,
		inquiry.OwnerSalesUserID,
		inquiry.AssignedSalesUserID,
		assigneeRole,
		status,
		inquiry.CreatedAt,
		inquiry.UpdatedAt,
		closedAtForInquiry(inquiry),
	).Scan(
		&conversation.ID,
		&conversation.CustomerUserID,
		&conversation.AssigneeUserID,
		&conversation.Status,
		&conversation.ClosedAt,
	)
	if err != nil {
		return supportConversationRow{}, false, fmt.Errorf("create support conversation for inquiry %s: %w", inquiry.ID, err)
	}
	return conversation, true, nil
}

func ensureSupportTextMessage(
	ctx context.Context,
	tx pgx.Tx,
	conversationID uuid.UUID,
	senderType string,
	senderUserID *uuid.UUID,
	senderRole *string,
	text string,
	createdAt time.Time,
) (bool, error) {
	if text == "" {
		return false, nil
	}

	var existingID uuid.UUID
	err := tx.QueryRow(ctx, `
SELECT id
FROM support_messages
WHERE conversation_id = $1
  AND sender_type = $2
  AND COALESCE(sender_user_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($3, '00000000-0000-0000-0000-000000000000'::uuid)
  AND message_type = $4
  AND COALESCE(text_content, '') = $5
LIMIT 1
`,
		conversationID,
		senderType,
		senderUserID,
		messageTypeText,
		text,
	).Scan(&existingID)
	if err == nil {
		return false, nil
	}
	if err != pgx.ErrNoRows {
		return false, fmt.Errorf("check support message duplication: %w", err)
	}

	if _, err := tx.Exec(ctx, `
INSERT INTO support_messages (
  conversation_id,
  sender_type,
  sender_user_id,
  sender_role,
  message_type,
  text_content,
  created_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
`,
		conversationID,
		senderType,
		senderUserID,
		senderRole,
		messageTypeText,
		text,
		createdAt,
	); err != nil {
		return false, fmt.Errorf("insert support message: %w", err)
	}
	return true, nil
}

func refreshConversationSnapshot(ctx context.Context, tx pgx.Tx, conversationID uuid.UUID) error {
	var preview string
	var messageType string
	var lastAt time.Time
	err := tx.QueryRow(ctx, `
SELECT COALESCE(text_content, ''), message_type, created_at
FROM support_messages
WHERE conversation_id = $1
ORDER BY created_at DESC, id DESC
LIMIT 1
`, conversationID).Scan(&preview, &messageType, &lastAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil
		}
		return fmt.Errorf("load support conversation snapshot %s: %w", conversationID, err)
	}

	if _, err := tx.Exec(ctx, `
UPDATE support_conversations
SET last_message_type = $2,
    last_message_preview = $3,
    last_message_at = $4,
    customer_unread_count = 0,
    staff_unread_count = 0,
    updated_at = GREATEST(updated_at, $4)
WHERE id = $1
`, conversationID, messageType, preview, lastAt); err != nil {
		return fmt.Errorf("update support conversation snapshot %s: %w", conversationID, err)
	}
	return nil
}

func inferConversationStatus(inquiry priceInquiryRow) string {
	if strings.EqualFold(strings.TrimSpace(inquiry.Status), "CLOSED") {
		return statusClosed
	}
	if inquiry.AssignedSalesUserID != nil {
		return statusOpenAssigned
	}
	return statusOpenUnassigned
}

func closedAtForInquiry(inquiry priceInquiryRow) *time.Time {
	if !strings.EqualFold(strings.TrimSpace(inquiry.Status), "CLOSED") {
		return nil
	}
	value := inquiry.UpdatedAt
	return &value
}

func normalizeInquiryMessageSender(message inquiryMessageRow) (string, *string) {
	switch strings.ToUpper(strings.TrimSpace(message.SenderType)) {
	case "CUSTOMER":
		return senderTypeCustomer, nil
	case "AI":
		return senderTypeSystem, nil
	default:
		role := "STAFF"
		return senderTypeStaff, &role
	}
}

func ptrUUID(value uuid.UUID) *uuid.UUID {
	return &value
}
