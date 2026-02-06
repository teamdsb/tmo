-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS wishlist_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id uuid NOT NULL,
    sku_id uuid NOT NULL REFERENCES catalog_skus(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_user_id, sku_id)
);

CREATE INDEX IF NOT EXISTS wishlist_items_owner_idx ON wishlist_items(owner_user_id);

CREATE TABLE IF NOT EXISTS product_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_user_id uuid NOT NULL,
    owner_sales_user_id uuid,
    name text NOT NULL,
    spec text,
    qty text,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_requests_created_by_idx ON product_requests(created_by_user_id);
CREATE INDEX IF NOT EXISTS product_requests_owner_sales_idx ON product_requests(owner_sales_user_id);
CREATE INDEX IF NOT EXISTS product_requests_created_at_idx ON product_requests(created_at);

CREATE TABLE IF NOT EXISTS after_sales_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status text NOT NULL,
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    created_by_user_id uuid NOT NULL,
    owner_sales_user_id uuid,
    assigned_staff_user_id uuid,
    subject text NOT NULL,
    description text NOT NULL,
    attachments text[] NOT NULL DEFAULT '{}'::text[],
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS after_sales_tickets_created_by_idx ON after_sales_tickets(created_by_user_id);
CREATE INDEX IF NOT EXISTS after_sales_tickets_owner_sales_idx ON after_sales_tickets(owner_sales_user_id);
CREATE INDEX IF NOT EXISTS after_sales_tickets_assignee_idx ON after_sales_tickets(assigned_staff_user_id);
CREATE INDEX IF NOT EXISTS after_sales_tickets_status_idx ON after_sales_tickets(status);
CREATE INDEX IF NOT EXISTS after_sales_tickets_order_idx ON after_sales_tickets(order_id);

CREATE TABLE IF NOT EXISTS after_sales_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES after_sales_tickets(id) ON DELETE CASCADE,
    sender_type text NOT NULL,
    sender_user_id uuid,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS after_sales_messages_ticket_idx ON after_sales_messages(ticket_id);

CREATE TABLE IF NOT EXISTS price_inquiries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_user_id uuid NOT NULL,
    owner_sales_user_id uuid,
    assigned_sales_user_id uuid,
    sku_id uuid REFERENCES catalog_skus(id) ON DELETE SET NULL,
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    message text NOT NULL,
    status text NOT NULL,
    response_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_inquiries_created_by_idx ON price_inquiries(created_by_user_id);
CREATE INDEX IF NOT EXISTS price_inquiries_owner_sales_idx ON price_inquiries(owner_sales_user_id);
CREATE INDEX IF NOT EXISTS price_inquiries_assigned_sales_idx ON price_inquiries(assigned_sales_user_id);
CREATE INDEX IF NOT EXISTS price_inquiries_status_idx ON price_inquiries(status);
CREATE INDEX IF NOT EXISTS price_inquiries_created_at_idx ON price_inquiries(created_at);

CREATE TABLE IF NOT EXISTS inquiry_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id uuid NOT NULL REFERENCES price_inquiries(id) ON DELETE CASCADE,
    sender_type text NOT NULL,
    sender_user_id uuid,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquiry_messages_inquiry_idx ON inquiry_messages(inquiry_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS inquiry_messages;
DROP TABLE IF EXISTS price_inquiries;
DROP TABLE IF EXISTS after_sales_messages;
DROP TABLE IF EXISTS after_sales_tickets;
DROP TABLE IF EXISTS product_requests;
DROP TABLE IF EXISTS wishlist_items;
-- +goose StatementEnd
