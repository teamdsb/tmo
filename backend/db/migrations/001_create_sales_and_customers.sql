CREATE TABLE IF NOT EXISTS sales_profiles (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    bind_code text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    phone text NOT NULL DEFAULT '',
    sales_id uuid NULL REFERENCES sales_profiles(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_sales_id ON customers(sales_id);
