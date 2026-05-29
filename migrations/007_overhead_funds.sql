-- ============================================================
-- CREAMEE ERP — Migration 007
-- Overhead allocation + Funds management
-- ============================================================

-- ── Chi phí cố định hàng tháng ───────────────────────────────
CREATE TABLE IF NOT EXISTS overhead_costs (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  year            SMALLINT      NOT NULL,
  month           TINYINT       NOT NULL,   -- 1-12
  category        VARCHAR(100)  NOT NULL,   -- Lương, Thuê kho, Tiện ích, Marketing, ...
  amount_vnd      DECIMAL(18,2) NOT NULL DEFAULT 0,
  notes           TEXT          NULL,
  created_by      VARCHAR(36)   NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_overhead (year, month, category),
  INDEX idx_overhead_ym (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Phân bổ chi phí vào từng SO ──────────────────────────────
CREATE TABLE IF NOT EXISTS order_cost_allocations (
  id                    VARCHAR(36)   NOT NULL PRIMARY KEY,
  sales_order_id        VARCHAR(36)   NOT NULL UNIQUE,
  -- Chi phí trực tiếp (COGS đã có trong SO items)
  direct_cogs_vnd       DECIMAL(18,2) NOT NULL DEFAULT 0,
  -- Chi phí ship phân bổ (từ shipments)
  ship_cost_vnd         DECIMAL(18,2) NOT NULL DEFAULT 0,
  -- Overhead phân bổ (tỷ lệ doanh thu tháng)
  overhead_allocated_vnd DECIMAL(18,2) NOT NULL DEFAULT 0,
  -- Doanh thu đơn
  revenue_vnd           DECIMAL(18,2) NOT NULL DEFAULT 0,
  -- Lãi gộp = revenue - direct_cogs - ship_cost
  gross_profit_vnd      DECIMAL(18,2) NOT NULL DEFAULT 0,
  -- Lãi ròng = gross_profit - overhead
  net_profit_vnd        DECIMAL(18,2) NOT NULL DEFAULT 0,
  -- Tháng áp dụng overhead
  overhead_year         SMALLINT      NULL,
  overhead_month        TINYINT       NULL,
  calculated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_oca_so (sales_order_id),
  INDEX idx_oca_ym (overhead_year, overhead_month),
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Quỹ tiền ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funds (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  fund_type       ENUM(
    'reserve',          -- Quỹ dự phòng
    'profit_withdrawal', -- Quỹ lợi nhuận rút
    'operating'         -- Quỹ vận hành
  ) NOT NULL UNIQUE,
  balance_vnd     DECIMAL(18,2) NOT NULL DEFAULT 0,
  last_updated    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  notes           TEXT          NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed 3 quỹ mặc định
INSERT INTO funds (id, fund_type, balance_vnd) VALUES
  (UUID(), 'reserve',           0),
  (UUID(), 'profit_withdrawal', 0),
  (UUID(), 'operating',         0)
ON DUPLICATE KEY UPDATE fund_type = fund_type;

-- ── Lịch sử giao dịch quỹ ───────────────────────────────────
CREATE TABLE IF NOT EXISTS fund_transactions (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  fund_type       ENUM('reserve','profit_withdrawal','operating') NOT NULL,
  transaction_type ENUM('deposit','withdrawal','transfer') NOT NULL,
  amount_vnd      DECIMAL(18,2) NOT NULL,
  from_fund       ENUM('reserve','profit_withdrawal','operating') NULL,
  to_fund         ENUM('reserve','profit_withdrawal','operating') NULL,
  reason          TEXT          NULL,
  reference_type  VARCHAR(50)   NULL,  -- 'sales_order', 'manual', ...
  reference_id    VARCHAR(36)   NULL,
  created_by      VARCHAR(36)   NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ft_fund (fund_type),
  INDEX idx_ft_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
