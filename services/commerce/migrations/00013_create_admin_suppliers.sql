-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS admin_suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_code text NOT NULL UNIQUE,
    name text NOT NULL,
    country text NOT NULL DEFAULT '',
    city text NOT NULL DEFAULT '',
    categories text[] NOT NULL DEFAULT '{}'::text[],
    status text NOT NULL DEFAULT 'ACTIVE',
    score integer NOT NULL DEFAULT 80,
    last_quote_amount_cents bigint,
    last_quote_at timestamptz,
    notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_suppliers_status_updated
    ON admin_suppliers (status, updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS admin_supplier_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id uuid NOT NULL REFERENCES admin_suppliers(id) ON DELETE CASCADE,
    name text NOT NULL,
    title text NOT NULL DEFAULT '',
    email text,
    phone text,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_supplier_contacts_supplier
    ON admin_supplier_contacts (supplier_id, is_primary DESC, updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS admin_supplier_scorecards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id uuid NOT NULL REFERENCES admin_suppliers(id) ON DELETE CASCADE,
    period text NOT NULL,
    delivery_score integer NOT NULL,
    quality_score integer NOT NULL,
    price_score integer NOT NULL,
    risk_level text NOT NULL DEFAULT 'LOW',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_supplier_scorecards_supplier_period
    ON admin_supplier_scorecards (supplier_id, period DESC, id DESC);

INSERT INTO admin_suppliers (
    id,
    supplier_code,
    name,
    country,
    city,
    categories,
    status,
    score,
    last_quote_amount_cents,
    last_quote_at,
    notes
)
VALUES
    (
        'd29fdcc6-1a40-4018-b7f4-83dca636fbd7',
        'SUP-88392',
        '环球科技方案',
        '美国',
        '圣何塞',
        ARRAY['电子','芯片'],
        'ACTIVE',
        98,
        1245000,
        now() - interval '2 days',
        '核心电子元件供应商，交付稳定。'
    ),
    (
        '8f9f5137-a0d9-4134-a0f8-b18f4d0cda93',
        'SUP-44210',
        '顶点高分子材料',
        '美国',
        '休斯敦',
        ARRAY['原材料','塑料'],
        'PAUSED',
        74,
        420000,
        now() - interval '3 weeks',
        '价格波动较大，阶段性暂停。'
    ),
    (
        'f0666f79-2f95-44e7-a0d1-6987ac0fd581',
        'SUP-99102',
        '子午线物流',
        '德国',
        '汉堡',
        ARRAY['运输','货运'],
        'ACTIVE',
        92,
        8500000,
        now() - interval '1 day',
        '欧洲线路主力物流合作方。'
    ),
    (
        '4e385641-bdfc-46aa-b4ac-57ee17ee9fef',
        'SUP-33219',
        '北辰制造',
        '加拿大',
        '多伦多',
        ARRAY['纺织'],
        'TERMINATED',
        42,
        110000,
        now() - interval '6 months',
        '因质量问题终止合作。'
    ),
    (
        'b90ef660-7bc0-44a2-a9bc-34495fdb5cf8',
        'SUP-99321',
        '量子零件',
        '中国',
        '深圳',
        ARRAY['电子','电路板'],
        'ACTIVE',
        88,
        3422000,
        now() - interval '7 days',
        '交期稳定，适合量产备选。'
    )
ON CONFLICT (id) DO UPDATE
SET
    supplier_code = EXCLUDED.supplier_code,
    name = EXCLUDED.name,
    country = EXCLUDED.country,
    city = EXCLUDED.city,
    categories = EXCLUDED.categories,
    status = EXCLUDED.status,
    score = EXCLUDED.score,
    last_quote_amount_cents = EXCLUDED.last_quote_amount_cents,
    last_quote_at = EXCLUDED.last_quote_at,
    notes = EXCLUDED.notes,
    updated_at = now();

INSERT INTO admin_supplier_contacts (
    id,
    supplier_id,
    name,
    title,
    email,
    phone,
    is_primary
)
VALUES
    (
        '42ae1f40-8b75-4575-b01c-67bc9d80ddf6',
        'd29fdcc6-1a40-4018-b7f4-83dca636fbd7',
        'Alice Johnson',
        '客户经理',
        'alice.johnson@global-tech.example',
        '+1 408 555 0188',
        true
    ),
    (
        '0f4dc6ca-76a9-4899-b7f1-f8c988cb8f1a',
        '8f9f5137-a0d9-4134-a0f8-b18f4d0cda93',
        'Mark Thomas',
        '销售总监',
        'mark.thomas@vertex-poly.example',
        '+1 713 555 0132',
        true
    ),
    (
        '3a627d3a-524a-4dc8-abf8-a7ca8d07fd47',
        'f0666f79-2f95-44e7-a0d1-6987ac0fd581',
        'Hans Weber',
        '高级客户经理',
        'hans.weber@meridian-logistics.example',
        '+49 40 3389 1200',
        true
    ),
    (
        '397ca2b4-f4d8-4ce9-b121-86e22b6ec7f9',
        '4e385641-bdfc-46aa-b4ac-57ee17ee9fef',
        'Liam Wilson',
        '客户经理',
        'liam.wilson@beichen.example',
        '+1 416 555 0172',
        true
    ),
    (
        '9418fef5-f0be-4038-9a60-f3e290f02158',
        'b90ef660-7bc0-44a2-a9bc-34495fdb5cf8',
        '陈工',
        '销售工程师',
        'chen.gong@quantum-parts.example',
        '+86 755 2888 1200',
        true
    )
ON CONFLICT (id) DO UPDATE
SET
    supplier_id = EXCLUDED.supplier_id,
    name = EXCLUDED.name,
    title = EXCLUDED.title,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    is_primary = EXCLUDED.is_primary,
    updated_at = now();

INSERT INTO admin_supplier_scorecards (
    id,
    supplier_id,
    period,
    delivery_score,
    quality_score,
    price_score,
    risk_level
)
VALUES
    (
        '3d89a966-43f2-4fb3-89ef-f6f1a1e95a65',
        'd29fdcc6-1a40-4018-b7f4-83dca636fbd7',
        '2026-02',
        98,
        99,
        92,
        'LOW'
    ),
    (
        'd3091f95-1948-49d7-bf45-b7828762d706',
        '8f9f5137-a0d9-4134-a0f8-b18f4d0cda93',
        '2026-02',
        72,
        78,
        66,
        'MEDIUM'
    ),
    (
        '2be197d2-e9df-4509-8404-e0666e7d4ab4',
        'f0666f79-2f95-44e7-a0d1-6987ac0fd581',
        '2026-02',
        94,
        91,
        89,
        'LOW'
    ),
    (
        'eb8d50e8-71b9-4a43-8da3-931f3d6021f7',
        '4e385641-bdfc-46aa-b4ac-57ee17ee9fef',
        '2026-02',
        45,
        39,
        58,
        'HIGH'
    ),
    (
        '99f8b259-a28c-4472-99f4-b7c18dd20593',
        'b90ef660-7bc0-44a2-a9bc-34495fdb5cf8',
        '2026-02',
        90,
        88,
        87,
        'LOW'
    )
ON CONFLICT (id) DO UPDATE
SET
    supplier_id = EXCLUDED.supplier_id,
    period = EXCLUDED.period,
    delivery_score = EXCLUDED.delivery_score,
    quality_score = EXCLUDED.quality_score,
    price_score = EXCLUDED.price_score,
    risk_level = EXCLUDED.risk_level;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_admin_supplier_scorecards_supplier_period;
DROP TABLE IF EXISTS admin_supplier_scorecards;

DROP INDEX IF EXISTS idx_admin_supplier_contacts_supplier;
DROP TABLE IF EXISTS admin_supplier_contacts;

DROP INDEX IF EXISTS idx_admin_suppliers_status_updated;
DROP TABLE IF EXISTS admin_suppliers;
-- +goose StatementEnd
