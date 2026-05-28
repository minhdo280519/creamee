-- ============================================================
-- CREAMEE ERP v7 — MySQL Schema + Seed Data
-- Yêu cầu: MySQL 8.0+
-- Chạy: mysql -u root -p < database.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS creamee CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE creamee;
SET NAMES utf8mb4;

-- ── Bảng sinh mã tuần tự ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS code_sequences (
  prefix   VARCHAR(10) PRIMARY KEY,
  last_val INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ── Profiles (người dùng nội bộ) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id             VARCHAR(36)  PRIMARY KEY,
  email          VARCHAR(255) NOT NULL UNIQUE,
  full_name      VARCHAR(255) NOT NULL,
  phone          VARCHAR(50)  NULL,
  role           ENUM('owner','accountant_lead','accountant','hr','manager','sales','warehouse','customer')
                              NOT NULL DEFAULT 'sales',
  password_hash  VARCHAR(255) NULL,
  avatar_url     VARCHAR(500) NULL,
  preferences    JSON         NOT NULL DEFAULT ('{}'),
  permissions    JSON         NOT NULL DEFAULT ('{}'),
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at  DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Khách hàng ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                  VARCHAR(36)  PRIMARY KEY,
  code                VARCHAR(50)  NOT NULL UNIQUE,
  name                VARCHAR(255) NOT NULL,
  phone               VARCHAR(50)  NULL,
  email               VARCHAR(255) NULL,
  address             TEXT         NULL,
  city                VARCHAR(100) NULL,
  tax_code            VARCHAR(50)  NULL,
  tier                ENUM('standard','vip','wholesale') NOT NULL DEFAULT 'standard',
  rfm_score           VARCHAR(10)  NULL,
  credit_limit        DECIMAL(18,2) NOT NULL DEFAULT 0,
  payment_terms_days  INT          NOT NULL DEFAULT 0,
  total_revenue       DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_orders        INT          NOT NULL DEFAULT 0,
  last_order_at       DATETIME     NULL,
  first_order_at      DATETIME     NULL,
  loyalty_points      INT          NOT NULL DEFAULT 0,
  notes               TEXT         NULL,
  is_active           TINYINT(1)   NOT NULL DEFAULT 1,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_email (email),
  INDEX idx_customers_name  (name)
) ENGINE=InnoDB;

-- ── Nhà cung cấp ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id             VARCHAR(36)  PRIMARY KEY,
  code           VARCHAR(50)  NOT NULL UNIQUE,
  name           VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255) NULL,
  phone          VARCHAR(50)  NULL,
  email          VARCHAR(255) NULL,
  address        TEXT         NULL,
  country        VARCHAR(10)  NOT NULL DEFAULT 'CN',
  currency       VARCHAR(10)  NOT NULL DEFAULT 'CNY',
  wechat_id      VARCHAR(100) NULL,
  notes          TEXT         NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Sản phẩm ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                  VARCHAR(36)   PRIMARY KEY,
  sku                 VARCHAR(100)  NOT NULL UNIQUE,
  name                VARCHAR(255)  NOT NULL,
  image_url           VARCHAR(500)  NULL,
  description         TEXT          NULL,
  category            VARCHAR(100)  NULL,
  supplier_id         VARCHAR(36)   NULL,
  cost_cny            DECIMAL(18,4) NULL,
  cost_vnd            DECIMAL(18,2) NULL,
  goods_cost_vnd      DECIMAL(18,2) NULL,
  ship_cost_vnd       DECIMAL(18,2) NULL,
  base_price_vnd      DECIMAL(18,2) NOT NULL DEFAULT 0,
  wholesale_price_vnd DECIMAL(18,2) NULL,
  weight_grams        DECIMAL(10,2) NULL,
  image_urls          JSON          NULL,
  current_stock       INT           NOT NULL DEFAULT 0,
  reorder_point       INT           NOT NULL DEFAULT 0,
  reorder_qty         INT           NOT NULL DEFAULT 0,
  is_active           TINYINT(1)    NOT NULL DEFAULT 1,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_supplier (supplier_id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Đơn bán hàng ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_orders (
  id                      VARCHAR(36)  PRIMARY KEY,
  code                    VARCHAR(50)  NOT NULL UNIQUE,
  customer_id             VARCHAR(36)  NOT NULL,
  quotation_id            VARCHAR(36)  NULL,
  order_date              DATE         NOT NULL,
  delivery_date           DATE         NULL,
  delivery_address        TEXT         NULL,
  subtotal                DECIMAL(18,2) NOT NULL DEFAULT 0,
  discount_amount         DECIMAL(18,2) NOT NULL DEFAULT 0,
  shipping_fee            DECIMAL(18,2) NOT NULL DEFAULT 0,
  tax_amount              DECIMAL(18,2) NOT NULL DEFAULT 0,
  total                   DECIMAL(18,2) NOT NULL DEFAULT 0,
  paid_amount             DECIMAL(18,2) NOT NULL DEFAULT 0,
  deposit_amount          DECIMAL(18,2) NOT NULL DEFAULT 0,
  delivered_amount        DECIMAL(18,2) NOT NULL DEFAULT 0,
  status                  ENUM('draft','pending_approval','approved','partial_paid','paid',
                               'partial_delivered','delivered','completed','cancelled')
                                       NOT NULL DEFAULT 'draft',
  payment_status          ENUM('unpaid','partial','paid','overpaid') NOT NULL DEFAULT 'unpaid',
  notes                   TEXT         NULL,
  loyalty_points_earned   INT          NOT NULL DEFAULT 0,
  loyalty_points_redeemed INT          NOT NULL DEFAULT 0,
  created_by              VARCHAR(36)  NULL,
  approved_by             VARCHAR(36)  NULL,
  approved_at             DATETIME     NULL,
  created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_so_customer   (customer_id),
  INDEX idx_so_status     (status),
  INDEX idx_so_date       (order_date),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB;

-- ── Dòng đơn bán ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_order_items (
  id                    VARCHAR(36)   PRIMARY KEY,
  order_id              VARCHAR(36)   NOT NULL,
  product_id            VARCHAR(36)   NOT NULL,
  variant_id            VARCHAR(36)   NULL,
  product_name_snapshot VARCHAR(255)  NOT NULL,
  quantity              INT           NOT NULL DEFAULT 1,
  delivered_qty         INT           NOT NULL DEFAULT 0,
  unit_price            DECIMAL(18,2) NOT NULL DEFAULT 0,
  discount_pct          DECIMAL(5,2)  NOT NULL DEFAULT 0,
  line_total            DECIMAL(18,2) NOT NULL DEFAULT 0,
  notes                 TEXT          NULL,
  sort_order            INT           NOT NULL DEFAULT 0,
  INDEX idx_soi_order   (order_id),
  FOREIGN KEY (order_id)    REFERENCES sales_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)  REFERENCES products(id)
) ENGINE=InnoDB;

-- ── Đơn nhập hàng ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id                    VARCHAR(36)   PRIMARY KEY,
  code                  VARCHAR(50)   NOT NULL UNIQUE,
  supplier_id           VARCHAR(36)   NOT NULL,
  so_id                 VARCHAR(36)   NULL,
  so_code               VARCHAR(50)   NULL,
  order_date            DATE          NOT NULL,
  expected_arrival_date DATE          NULL,
  currency              VARCHAR(10)   NOT NULL DEFAULT 'CNY',
  fx_rate               DECIMAL(10,4) NOT NULL DEFAULT 1,
  subtotal_cny          DECIMAL(18,4) NOT NULL DEFAULT 0,
  shipping_cny          DECIMAL(18,4) NOT NULL DEFAULT 0,
  total_cny             DECIMAL(18,4) NOT NULL DEFAULT 0,
  total_vnd             DECIMAL(18,2) NOT NULL DEFAULT 0,
  paid_cny              DECIMAL(18,4) NOT NULL DEFAULT 0,
  status                ENUM('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
  payment_status        ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  notes                 TEXT          NULL,
  created_by            VARCHAR(36)   NULL,
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_po_supplier (supplier_id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
) ENGINE=InnoDB;

-- ── Dòng đơn nhập ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                    VARCHAR(36)   PRIMARY KEY,
  po_id                 VARCHAR(36)   NOT NULL,
  product_id            VARCHAR(36)   NOT NULL,
  product_name_snapshot VARCHAR(255)  NOT NULL,
  quantity              INT           NOT NULL DEFAULT 1,
  received_qty          INT           NOT NULL DEFAULT 0,
  unit_cost_cny         DECIMAL(18,4) NOT NULL DEFAULT 0,
  line_total_cny        DECIMAL(18,4) NOT NULL DEFAULT 0,
  alloc_ship_cost_vnd   DECIMAL(18,2) NOT NULL DEFAULT 0,
  sort_order            INT           NOT NULL DEFAULT 0,
  INDEX idx_poi_po      (po_id),
  FOREIGN KEY (po_id)       REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)  REFERENCES products(id)
) ENGINE=InnoDB;

-- ── Đơn vị vận chuyển ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_carriers (
  id              VARCHAR(36)   PRIMARY KEY,
  name            VARCHAR(255)  NOT NULL,
  contact         VARCHAR(255)  NULL,
  rate_cny_per_kg DECIMAL(10,4) NOT NULL DEFAULT 0,
  min_charge_cny  DECIMAL(10,4) NOT NULL DEFAULT 0,
  notes           TEXT          NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS carrier_rate_history (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  carrier_id      VARCHAR(36)   NOT NULL,
  rate_cny_per_kg DECIMAL(10,4) NOT NULL DEFAULT 0,
  recorded_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (carrier_id) REFERENCES shipping_carriers(id)
) ENGINE=InnoDB;

-- ── Chặng vận chuyển ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipments (
  id              VARCHAR(36)   PRIMARY KEY,
  code            VARCHAR(50)   NOT NULL UNIQUE,
  tracking_number VARCHAR(200)  NULL,
  so_id           VARCHAR(36)   NULL,
  so_code         VARCHAR(50)   NULL,
  leg             ENUM('cn_domestic','cn_to_vn','vn_domestic','vn_to_customer') NOT NULL,
  carrier_id      VARCHAR(36)   NULL,
  payer           ENUM('ncc_advance','we_pay_now','we_arrange') NOT NULL DEFAULT 'we_pay_now',
  charge_mode     ENUM('per_kg','flat') NOT NULL DEFAULT 'per_kg',
  rate_per_kg_cny DECIMAL(10,4) NOT NULL DEFAULT 0,
  flat_cost       DECIMAL(18,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(10)   NOT NULL DEFAULT 'CNY',
  fx_rate         DECIMAL(10,4) NOT NULL DEFAULT 1,
  total_weight_kg DECIMAL(10,3) NOT NULL DEFAULT 0,
  total_cost_vnd  DECIMAL(18,2) NOT NULL DEFAULT 0,
  dispatched_at   DATETIME      NULL,
  arrived_at      DATETIME      NULL,
  delay_status    VARCHAR(100)  NULL,
  notes           TEXT          NULL,
  created_by      VARCHAR(36)   NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (carrier_id) REFERENCES shipping_carriers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shipment_items (
  id                    VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  shipment_id           VARCHAR(36)   NOT NULL,
  po_id                 VARCHAR(36)   NOT NULL,
  po_item_id            VARCHAR(36)   NOT NULL,
  product_id            VARCHAR(36)   NOT NULL,
  product_name_snapshot VARCHAR(255)  NOT NULL,
  quantity              INT           NOT NULL DEFAULT 1,
  weight_kg             DECIMAL(10,3) NOT NULL DEFAULT 0,
  alloc_cost_vnd        DECIMAL(18,2) NOT NULL DEFAULT 0,
  alloc_unit_vnd        DECIMAL(18,4) NOT NULL DEFAULT 0,
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_si_shipment (shipment_id),
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Lô tồn kho (FIFO) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_lots (
  id              VARCHAR(36)   PRIMARY KEY,
  product_id      VARCHAR(36)   NOT NULL,
  po_item_id      VARCHAR(36)   NULL,
  lot_code        VARCHAR(100)  NOT NULL,
  qty_total       INT           NOT NULL DEFAULT 0,
  qty_available   INT           NOT NULL DEFAULT 0,
  goods_unit_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
  ship_unit_cost  DECIMAL(18,4) NOT NULL DEFAULT 0,
  is_negative     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_il_product (product_id),
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

-- ── Log xuất kho theo lô ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_lot_lines (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  order_id        VARCHAR(36)   NOT NULL,
  order_item_id   VARCHAR(36)   NOT NULL,
  product_id      VARCHAR(36)   NOT NULL,
  lot_id          VARCHAR(36)   NOT NULL,
  qty             INT           NOT NULL DEFAULT 0,
  goods_unit_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
  ship_unit_cost  DECIMAL(18,4) NOT NULL DEFAULT 0,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dll_order (order_id)
) ENGINE=InnoDB;

-- ── CRM — Cơ hội bán hàng ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id                     VARCHAR(36)   PRIMARY KEY,
  code                   VARCHAR(50)   NOT NULL UNIQUE,
  title                  VARCHAR(500)  NOT NULL,
  customer_id            VARCHAR(36)   NULL,
  customer_name_snapshot VARCHAR(255)  NULL,
  stage                  ENUM('new','qualified','proposal','negotiation','won','lost')
                                       NOT NULL DEFAULT 'new',
  estimated_value        DECIMAL(18,2) NULL,
  probability_pct        INT           NOT NULL DEFAULT 50,
  expected_close_date    DATE          NULL,
  actual_close_date      DATE          NULL,
  assigned_to            VARCHAR(36)   NULL,
  source                 VARCHAR(100)  NULL,
  next_action            TEXT          NULL,
  next_action_date       DATE          NULL,
  lost_reason            TEXT          NULL,
  notes                  TEXT          NULL,
  created_by             VARCHAR(36)   NULL,
  created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_deals_stage (stage)
) ENGINE=InnoDB;

-- ── Thu chi tiền mặt ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_transactions (
  id               VARCHAR(36)   PRIMARY KEY,
  code             VARCHAR(50)   NOT NULL UNIQUE,
  transaction_date DATE          NOT NULL,
  transaction_type ENUM('income','expense','transfer') NOT NULL,
  account          ENUM('main','sub','bank','ewallet') NOT NULL DEFAULT 'main',
  category         VARCHAR(100)  NULL,
  amount_vnd       DECIMAL(18,2) NOT NULL DEFAULT 0,
  currency         VARCHAR(10)   NOT NULL DEFAULT 'VND',
  payment_method   VARCHAR(50)   NOT NULL DEFAULT 'cash',
  reference_type   VARCHAR(50)   NULL,
  reference_code   VARCHAR(100)  NULL,
  counterparty_name VARCHAR(255) NULL,
  customer_id      VARCHAR(36)   NULL,
  supplier_id      VARCHAR(36)   NULL,
  description      TEXT          NULL,
  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_by       VARCHAR(36)   NULL,
  approved_by      VARCHAR(36)   NULL,
  approved_at      DATETIME      NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ct_date   (transaction_date),
  INDEX idx_ct_status (status)
) ENGINE=InnoDB;

-- ── Tỷ giá ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fx_rates (
  id            VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  rate_date     DATE        NOT NULL,
  from_currency VARCHAR(10) NOT NULL,
  to_currency   VARCHAR(10) NOT NULL,
  rate          DECIMAL(18,6) NOT NULL DEFAULT 0,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fx (rate_date, from_currency, to_currency)
) ENGINE=InnoDB;

-- ── Cài đặt ứng dụng ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  id         VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  `key`      VARCHAR(100)  NOT NULL UNIQUE,
  value      DECIMAL(18,6) NOT NULL DEFAULT 0,
  updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Tích hợp (LLM API keys) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
  id         VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  name       VARCHAR(100) NOT NULL UNIQUE,
  type       VARCHAR(50)  NOT NULL DEFAULT 'llm',
  config     JSON         NOT NULL DEFAULT ('{}'),
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Phê duyệt ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approvals (
  id           VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  entity_type  VARCHAR(50)   NOT NULL,
  entity_id    VARCHAR(36)   NOT NULL,
  entity_code  VARCHAR(100)  NULL,
  reason       TEXT          NULL,
  amount       DECIMAL(18,2) NULL,
  requested_by VARCHAR(36)   NULL,
  status       ENUM('pending','approved','rejected','escalated') NOT NULL DEFAULT 'pending',
  decided_by   VARCHAR(36)   NULL,
  decided_at   DATETIME      NULL,
  decision_notes TEXT        NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_approvals_entity (entity_type, entity_id),
  INDEX idx_approvals_status (status)
) ENGINE=InnoDB;

-- ── Quản lý mẫu ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS samples (
  id                     VARCHAR(36)   PRIMARY KEY,
  code                   VARCHAR(50)   NOT NULL UNIQUE,
  customer_id            VARCHAR(36)   NOT NULL,
  product_id             VARCHAR(36)   NULL,
  product_name           VARCHAR(255)  NOT NULL,
  supplier_id            VARCHAR(36)   NULL,
  status                 ENUM('pending','approved','cancelled') NOT NULL DEFAULT 'pending',
  deposit_amount         DECIMAL(18,2) NOT NULL DEFAULT 3500000,
  deposit_paid           DECIMAL(18,2) NOT NULL DEFAULT 0,
  refund_amount          DECIMAL(18,2) NOT NULL DEFAULT 0,
  goods_cost_cny         DECIMAL(18,4) NOT NULL DEFAULT 0,
  goods_cost_vnd         DECIMAL(18,2) NOT NULL DEFAULT 0,
  ship_cost_vnd          DECIMAL(18,2) NOT NULL DEFAULT 0,
  sample_fee_vnd         DECIMAL(18,2) NOT NULL DEFAULT 0,
  other_cost_vnd         DECIMAL(18,2) NOT NULL DEFAULT 0,
  fx_rate                DECIMAL(10,4) NOT NULL DEFAULT 3625,
  cumulative_qty_ordered INT           NOT NULL DEFAULT 0,
  notes                  TEXT          NULL,
  created_by             VARCHAR(36)   NULL,
  created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_samples_customer (customer_id),
  INDEX idx_samples_status   (status),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (product_id)  REFERENCES products(id)  ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Thông báo ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  recipient_id VARCHAR(36)  NOT NULL,
  type         VARCHAR(50)  NOT NULL,
  title        VARCHAR(255) NOT NULL,
  body         TEXT         NULL,
  link         VARCHAR(500) NULL,
  is_read      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_recipient (recipient_id)
) ENGINE=InnoDB;

-- ── Màu sắc sản phẩm ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_colors (
  id        VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  code      VARCHAR(20)  NOT NULL UNIQUE,
  name_vi   VARCHAR(100) NOT NULL,
  is_active TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Cài đặt mặc định ─────────────────────────────────────────────────────────
INSERT IGNORE INTO app_settings (id, `key`, value) VALUES
  (UUID(), 'order_approval_threshold', 50000000),
  (UUID(), 'fx_cny_vnd', 3625);

-- ── 10 tài khoản mẫu (mật khẩu: Creamee@2024) ───────────────────────────────
SET @pw = '$2a$10$pgcIQMqwSa8YN24vzIby9eM9QH5uIK8cqvvnzYnzWczVrv4WGCvru';
INSERT IGNORE INTO profiles (id, email, full_name, role, phone, password_hash, is_active) VALUES
  (UUID(), 'chu@creamee.vn',          'Đỗ Chí Đức (Chủ)',            'owner',          '0900000001', @pw, 1),
  (UUID(), 'ketoantruong@creamee.vn', 'Nguyễn Thị Lan (KT trưởng)', 'accountant_lead','0900000002', @pw, 1),
  (UUID(), 'ketoan1@creamee.vn',      'Trần Văn Minh (KT viên)',     'accountant',     '0900000003', @pw, 1),
  (UUID(), 'ketoan2@creamee.vn',      'Lê Thị Hoa (KT viên)',        'accountant',     '0900000004', @pw, 1),
  (UUID(), 'nhansu@creamee.vn',       'Phạm Thu Hà (Nhân sự)',       'hr',             '0900000005', @pw, 1),
  (UUID(), 'manager@creamee.vn',      'Vũ Quốc Anh (Manager)',       'manager',        '0900000006', @pw, 1),
  (UUID(), 'sale1@creamee.vn',        'Hoàng Văn Nam (Sale)',         'sales',          '0900000007', @pw, 1),
  (UUID(), 'sale2@creamee.vn',        'Đặng Thị Mai (Sale)',          'sales',          '0900000008', @pw, 1),
  (UUID(), 'kho1@creamee.vn',         'Bùi Văn Tú (Kho)',             'warehouse',      '0900000009', @pw, 1),
  (UUID(), 'kho2@creamee.vn',         'Ngô Thị Yến (Kho)',            'warehouse',      '0900000010', @pw, 1);

-- ── Biến tham chiếu UID ───────────────────────────────────────────────────────
SET @uid_owner   = (SELECT id FROM profiles WHERE email = 'chu@creamee.vn');
SET @uid_ktlead  = (SELECT id FROM profiles WHERE email = 'ketoantruong@creamee.vn');
SET @uid_sale1   = (SELECT id FROM profiles WHERE email = 'sale1@creamee.vn');
SET @uid_sale2   = (SELECT id FROM profiles WHERE email = 'sale2@creamee.vn');
SET @uid_manager = (SELECT id FROM profiles WHERE email = 'manager@creamee.vn');
SET @uid_kho1    = (SELECT id FROM profiles WHERE email = 'kho1@creamee.vn');

-- ── Tỷ giá ───────────────────────────────────────────────────────────────────
INSERT IGNORE INTO fx_rates (id, rate_date, from_currency, to_currency, rate) VALUES
  (UUID(), DATE_SUB(CURDATE(), INTERVAL 60 DAY), 'CNY', 'VND', 3565.00),
  (UUID(), DATE_SUB(CURDATE(), INTERVAL 45 DAY), 'CNY', 'VND', 3580.00),
  (UUID(), DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'CNY', 'VND', 3598.00),
  (UUID(), DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'CNY', 'VND', 3610.00),
  (UUID(), CURDATE(),                            'CNY', 'VND', 3625.00),
  (UUID(), DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'USD', 'VND', 25200.00),
  (UUID(), CURDATE(),                            'USD', 'VND', 25450.00);

-- ── Đơn vị vận chuyển ────────────────────────────────────────────────────────
INSERT IGNORE INTO shipping_carriers (id, name, contact, rate_cny_per_kg, min_charge_cny, is_active) VALUES
  ('cc000001-0000-0000-0000-000000000001', 'SF Express (顺丰速运)',    'WeChat: sfexpress_vn', 4.50, 50.00, 1),
  ('cc000001-0000-0000-0000-000000000002', 'J&T Express',              'Hotline: 1900 4545',   3.20, 30.00, 1),
  ('cc000001-0000-0000-0000-000000000003', 'Yunda Express (韵达)',      'WeChat: yunda_cn',     2.80, 25.00, 1),
  ('cc000001-0000-0000-0000-000000000004', 'Best Express (百世汇通)',   'WeChat: best_vn',      3.50, 35.00, 1);

INSERT IGNORE INTO carrier_rate_history (id, carrier_id, rate_cny_per_kg) VALUES
  (UUID(), 'cc000001-0000-0000-0000-000000000001', 4.50),
  (UUID(), 'cc000001-0000-0000-0000-000000000002', 3.20),
  (UUID(), 'cc000001-0000-0000-0000-000000000003', 2.80),
  (UUID(), 'cc000001-0000-0000-0000-000000000004', 3.50);

-- ── Nhà cung cấp ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO suppliers (id, code, name, contact_person, phone, email, address, country, currency, wechat_id, notes, is_active) VALUES
  ('aa000001-0000-0000-0000-000000000001','NCC001','Guangzhou Fashion Hub Co., Ltd','Wang Lei','+86-020-8888-1234','wanglei@gzfashion.cn','No.88 Zhongshan Ave, Guangzhou','CN','CNY','wxid_wanglei88','NCC chính - quần áo thời trang đại trà',1),
  ('aa000001-0000-0000-0000-000000000002','NCC002','Shenzhen Trendy Wear Ltd','Liu Fang','+86-0755-9999-5678','liufang@sztrendy.cn','4F, Fashion Center, Longhua District, Shenzhen','CN','CNY','wxid_liufang_sz','Chuyên thời trang trẻ, hàng mẫu cập nhật nhanh',1),
  ('aa000001-0000-0000-0000-000000000003','NCC003','Hangzhou Silk Palace','Chen Wei','+86-0571-6666-7890','chenwei@hzsilk.cn','Silk Road Industrial Park, Hangzhou','CN','CNY','wxid_chenwei_hz','Hàng lụa cao cấp, áo dài cách tân',1),
  ('aa000001-0000-0000-0000-000000000004','NCC004','Foshan Denim World Factory','Zhang Min','+86-0757-7777-2345','zhangmin@fsdenim.cn','Denim Industrial Zone, Foshan','CN','CNY','wxid_zhangmin_fs','Chuyên jeans nam nữ',1),
  ('aa000001-0000-0000-0000-000000000005','NCC005','Shanghai Style Group','Li Xin','+86-021-5555-6789','lixin@shstyle.cn','1288 Nanjing West Road, Shanghai','CN','CNY','wxid_lixin_sh','Hàng cao cấp, thương hiệu nội địa TQ',1),
  ('aa000001-0000-0000-0000-000000000006','NCC006','Yiwu Accessories Trading Co','Zhou Na','+86-0579-4444-3456','zhouna@ywacces.cn','No.1 Chouzhou North Road, Yiwu','CN','CNY','wxid_zhouna_yw','Phụ kiện, cài áo, khuy, dây kéo',1);

-- ── Khách hàng ───────────────────────────────────────────────────────────────
INSERT IGNORE INTO customers (id, code, name, phone, email, address, city, tax_code, tier, credit_limit, payment_terms_days, total_revenue, total_orders, is_active) VALUES
  ('bb000001-0000-0000-0000-000000000001','KH000001','Shop Thời Trang Linh','0901234567','linh.fashion@gmail.com','45 Nguyễn Huệ, Q1','TP. Hồ Chí Minh','0301234567','vip',    50000000,30,145000000,18,1),
  ('bb000001-0000-0000-0000-000000000002','KH000002','Boutique Mỹ Duyên',  '0912345678','myduyenboutique@gmail.com','12 Hàng Bài, Hoàn Kiếm','Hà Nội','0100876543','wholesale',80000000,45,230000000,25,1),
  ('bb000001-0000-0000-0000-000000000003','KH000003','Cửa hàng 365 Fashion','0923456789','365fashion.shop@gmail.com','88 Lê Lợi, Q1','TP. Hồ Chí Minh','0302345678','wholesale',60000000,30,185000000,22,1),
  ('bb000001-0000-0000-0000-000000000004','KH000004','Thời Trang Thu Hà',  '0934567890','thuha.fashion@gmail.com','23 Trần Phú, Hải Châu','Đà Nẵng','0400345678','standard',20000000,15,68000000,12,1),
  ('bb000001-0000-0000-0000-000000000005','KH000005','Shop Áo Đẹp Cần Thơ','0945678901','aodep.cantho@gmail.com','55 Hòa Bình, Ninh Kiều','Cần Thơ','1800456789','standard',15000000,15,42000000, 8,1),
  ('bb000001-0000-0000-0000-000000000006','KH000006','Mia Fashion Store',  '0956789012','mia.fashion.vn@gmail.com','120 Đồng Khởi, Q1','TP. Hồ Chí Minh','0303456789','vip',    70000000,30,310000000,30,1),
  ('bb000001-0000-0000-0000-000000000007','KH000007','Hà Nội Style Boutique','0967890123','hanoistyle@gmail.com','8 Hàng Ngang, Hoàn Kiếm','Hà Nội','0101567890','wholesale',90000000,45,275000000,28,1),
  ('bb000001-0000-0000-0000-000000000008','KH000008','Thời Trang Biển Sáng','0978901234','biensang.fashion@gmail.com','34 Bạch Đằng, Hải Châu','Đà Nẵng','0401678901','standard',10000000,15,28000000, 6,1),
  ('bb000001-0000-0000-0000-000000000009','KH000009','Shop Local Hà Nội',  '0989012345','shoplocal.hn@gmail.com','67 Cầu Giấy, Cầu Giấy','Hà Nội','0102789012','standard',10000000, 0,18500000, 5,1),
  ('bb000001-0000-0000-0000-000000000010','KH000010','Fashion Corner Huế', '0990123456','fashioncorner.hue@gmail.com','15 Lê Lợi, Phú Hội','Huế','4600890123','standard', 8000000,15,12000000, 4,1),
  ('bb000001-0000-0000-0000-000000000011','KH000011','Thời Trang Lê Lợi',  '0901234560','leloi.fashion@gmail.com','200 Lê Lợi, Q1','TP. Hồ Chí Minh','0304901234','vip',    55000000,30,188000000,20,1),
  ('bb000001-0000-0000-0000-000000000012','KH000012','Cửa Hàng Xinh Đẹp',  '0912345670','xinhde.hp@gmail.com','44 Điện Biên Phủ, Ngô Quyền','Hải Phòng','0301012345','standard',12000000,15,35000000, 7,1),
  ('bb000001-0000-0000-0000-000000000013','KH000013','Boutique Minh Phương','0923456780','minhphuong.boutique@gmail.com','5 Tràng Tiền, Hoàn Kiếm','Hà Nội','0103123456','wholesale',75000000,30,195000000,21,1),
  ('bb000001-0000-0000-0000-000000000014','KH000014','Thời Trang Nha Trang','0934567800','nhatrang.fashion@gmail.com','78 Yersin, Lộc Thọ','Nha Trang','5600234567','standard', 8000000,15,22000000, 5,1),
  ('bb000001-0000-0000-0000-000000000015','KH000015','Trendy Online Store', '0945678900','trendy.online.vn@gmail.com','Online — kho tại 30/4, Q.Tân Bình','TP. Hồ Chí Minh','0305345678','vip',    40000000,14,125000000,15,1);

-- ── Sản phẩm (20 mã) ─────────────────────────────────────────────────────────
INSERT IGNORE INTO products (id, sku, name, description, category, supplier_id, cost_cny, goods_cost_vnd, ship_cost_vnd, cost_vnd, base_price_vnd, wholesale_price_vnd, weight_grams, current_stock, reorder_point, reorder_qty, is_active) VALUES
  ('dd000001-0000-0000-0000-000000000001','AT-BASIC', 'Áo thun basic unisex',         'Cotton 100%, dày dặn, 6 màu cơ bản',         'Áo thun',  'aa000001-0000-0000-0000-000000000001',  35.00, 125300, 8500, 133800, 165000,148000,200,120,50,200,1),
  ('dd000001-0000-0000-0000-000000000002','AT-PRINT', 'Áo thun in hình local brand',  'Graphic tee, Cotton 100%, nhiều họa tiết',    'Áo thun',  'aa000001-0000-0000-0000-000000000001',  45.00, 161100,10200,171300, 220000,195000,210,130,40,150,1),
  ('dd000001-0000-0000-0000-000000000003','QJ-SLIM-M','Quần jean slim fit nam',        'Denim 12oz, co giãn 2%, 3 màu',               'Quần jean','aa000001-0000-0000-0000-000000000004',  95.00, 340100,25600,365700, 450000,405000,650,120,30,100,1),
  ('dd000001-0000-0000-0000-000000000004','QJ-SKIN-F','Quần jean skinny nữ',           'Denim 11oz, 5% spandex, ôm dáng',             'Quần jean','aa000001-0000-0000-0000-000000000004',  88.00, 316800,24800,341600, 420000,375000,580,100,30,100,1),
  ('dd000001-0000-0000-0000-000000000005','VH-MIDI',  'Váy hoa midi dáng A',           'Voan họa tiết hoa, dài qua gối',              'Váy',      'aa000001-0000-0000-0000-000000000002',  78.00, 279240,18200,297440, 380000,340000,350,  0,20, 80,1),
  ('dd000001-0000-0000-0000-000000000006','SM-NAM',   'Áo sơ mi nam công sở',          'Cotton-Polyester, dài tay, 4 màu',            'Sơ mi',    'aa000001-0000-0000-0000-000000000001',  65.00, 232700,12400,245100, 320000,288000,300,  0,20, 80,1),
  ('dd000001-0000-0000-0000-000000000007','SM-NU',    'Áo sơ mi nữ văn phòng',         'Lụa matte, bo tay, 5 màu pastel',             'Sơ mi',    'aa000001-0000-0000-0000-000000000003',  58.00, 207640,11800,219440, 285000,255000,260,  0,20, 80,1),
  ('dd000001-0000-0000-0000-000000000008','AK-BOMB',  'Áo khoác bomber',               'Polyester, lót bông nhẹ, nhiều màu',          'Áo khoác', 'aa000001-0000-0000-0000-000000000001', 165.00, 590700,35400,626100, 780000,700000,600, 80,15, 60,1),
  ('dd000001-0000-0000-0000-000000000009','DD-TIEC',  'Đầm dự tiệc đính đá',           'Chiffon cao cấp, tay bồng, đính đá viền cổ', 'Đầm',      'aa000001-0000-0000-0000-000000000005', 195.00, 697100,45200,742300, 950000,855000,450,  0,10, 40,1),
  ('dd000001-0000-0000-0000-000000000010','AL-DONG',  'Áo len mùa đông cổ tròn',       'Wool blend 40%, ấm áp, dáng oversize',        'Áo len',   'aa000001-0000-0000-0000-000000000001',  88.00, 315040,22600,337640, 420000,378000,550,  0,20, 80,1),
  ('dd000001-0000-0000-0000-000000000011','AH-HOOD',  'Áo hoodie unisex',               'Cotton fleece, túi chuột, 6 màu',             'Áo hoodie','aa000001-0000-0000-0000-000000000002', 125.00, 447500,28400,475900, 590000,530000,480,  0,20, 80,1),
  ('dd000001-0000-0000-0000-000000000012','QS-NAM',   'Quần short nam casual',          'Cotton twill, 3 túi, 4 màu',                  'Quần short','aa000001-0000-0000-0000-000000000001',  45.00, 161100, 9800,170900, 215000,193000,280,  0,30,100,1),
  ('dd000001-0000-0000-0000-000000000013','VA-CHUA',  'Váy chữ A midi',                 'Crepe, lưng đàn hồi, 4 màu trơn',             'Váy',      'aa000001-0000-0000-0000-000000000002',  68.00, 243440,16500,259940, 330000,295000,320,  0,20, 80,1),
  ('dd000001-0000-0000-0000-000000000014','AC-CROP',  'Áo crop top nữ',                 'Rib cotton, ngắn tay, nhiều màu',             'Áo thun',  'aa000001-0000-0000-0000-000000000002',  38.00, 136040, 8200,144240, 185000,165000,180,  0,30,120,1),
  ('dd000001-0000-0000-0000-000000000015','QT-NU',    'Quần tây nữ suông',              'Kaki mềm, cạp cao, 4 màu',                    'Quần tây', 'aa000001-0000-0000-0000-000000000002',  75.00, 268500,18600,287100, 360000,324000,420,  0,20, 80,1),
  ('dd000001-0000-0000-0000-000000000016','AD-CAT',   'Áo dài cách tân',                'Lụa tơ tằm, thêu họa tiết hoa sen',           'Áo dài',   'aa000001-0000-0000-0000-000000000003', 185.00, 662300,52400,714700, 890000,800000,500,  0, 8, 30,1),
  ('dd000001-0000-0000-0000-000000000017','DC-CAS',   'Đầm casual dáng suông',          'Vải thun gân, thun eo, tay ngắn',             'Đầm',      'aa000001-0000-0000-0000-000000000001',  72.00, 257760,15800,273560, 350000,315000,340,  0,20, 80,1),
  ('dd000001-0000-0000-0000-000000000018','AP-POLO',  'Áo polo nam basic',              'Pique cotton, cổ bẻ, 5 màu',                 'Áo polo',  'aa000001-0000-0000-0000-000000000001',  55.00, 196900,12200,209100, 265000,238000,260,  0,20, 80,1),
  ('dd000001-0000-0000-0000-000000000019','QJ-BO',    'Quần jeans bô (baggy)',           'Denim wash, dáng thùng, unisex',              'Quần jean','aa000001-0000-0000-0000-000000000004',  98.00, 352800,28400,381200, 470000,423000,700, 60,20, 80,1),
  ('dd000001-0000-0000-0000-000000000020','AC-CARD',  'Áo cardigan len mỏng',           'Acrylic blend, dáng dài, 5 màu',              'Áo khoác', 'aa000001-0000-0000-0000-000000000002', 115.00, 411700,24600,436300, 555000,499000,420,  0,15, 60,1);

-- ── Đơn nhập hàng ────────────────────────────────────────────────────────────
INSERT IGNORE INTO purchase_orders (id, code, supplier_id, order_date, expected_arrival_date, currency, fx_rate, subtotal_cny, shipping_cny, total_cny, total_vnd, paid_cny, status, payment_status, notes, created_by) VALUES
  ('ee000001-0000-0000-0000-000000000001','PO000001','aa000001-0000-0000-0000-000000000001',DATE_SUB(CURDATE(),INTERVAL 60 DAY),DATE_SUB(CURDATE(),INTERVAL 45 DAY),'CNY',3580.00,26950.00,800.00,27750.00,99345000,27750.00,'received','paid','Đơn nhập quý 3 — áo thun & áo khoác',@uid_owner),
  ('ee000001-0000-0000-0000-000000000002','PO000002','aa000001-0000-0000-0000-000000000004',DATE_SUB(CURDATE(),INTERVAL 45 DAY),DATE_SUB(CURDATE(),INTERVAL 30 DAY),'CNY',3600.00,28040.00,1200.00,29240.00,105264000,15000.00,'received','partial','Đơn jeans — nam skinny & bô',@uid_owner),
  ('ee000001-0000-0000-0000-000000000003','PO000003','aa000001-0000-0000-0000-000000000002',DATE_SUB(CURDATE(),INTERVAL 14 DAY),DATE_ADD(CURDATE(),INTERVAL 14 DAY),'CNY',3625.00,33400.00,0.00,33400.00,121090000,10000.00,'ordered','partial','Váy hoa + hoodie + cardigan cho mùa hè',@uid_manager);

-- ── Dòng đơn nhập ────────────────────────────────────────────────────────────
INSERT IGNORE INTO purchase_order_items (id, po_id, product_id, product_name_snapshot, quantity, received_qty, unit_cost_cny, line_total_cny, sort_order) VALUES
  ('ef000001-0000-0000-0000-000000000001','ee000001-0000-0000-0000-000000000001','dd000001-0000-0000-0000-000000000001','Áo thun basic unisex',     200,200, 35.00, 7000.00,0),
  ('ef000001-0000-0000-0000-000000000002','ee000001-0000-0000-0000-000000000001','dd000001-0000-0000-0000-000000000002','Áo thun in hình local brand',150,150, 45.00, 6750.00,1),
  ('ef000001-0000-0000-0000-000000000003','ee000001-0000-0000-0000-000000000001','dd000001-0000-0000-0000-000000000008','Áo khoác bomber',           80, 80,165.00,13200.00,2),
  ('ef000001-0000-0000-0000-000000000004','ee000001-0000-0000-0000-000000000002','dd000001-0000-0000-0000-000000000003','Quần jean slim fit nam',   120,120, 95.00,11400.00,0),
  ('ef000001-0000-0000-0000-000000000005','ee000001-0000-0000-0000-000000000002','dd000001-0000-0000-0000-000000000004','Quần jean skinny nữ',      100,100, 88.00, 8800.00,1),
  ('ef000001-0000-0000-0000-000000000006','ee000001-0000-0000-0000-000000000002','dd000001-0000-0000-0000-000000000019','Quần jeans bô (baggy)',      80, 80, 98.00, 7840.00,2),
  ('ef000001-0000-0000-0000-000000000007','ee000001-0000-0000-0000-000000000003','dd000001-0000-0000-0000-000000000005','Váy hoa midi dáng A',       150,  0, 78.00,11700.00,0),
  ('ef000001-0000-0000-0000-000000000008','ee000001-0000-0000-0000-000000000003','dd000001-0000-0000-0000-000000000011','Áo hoodie unisex',          100,  0,125.00,12500.00,1),
  ('ef000001-0000-0000-0000-000000000009','ee000001-0000-0000-0000-000000000003','dd000001-0000-0000-0000-000000000020','Áo cardigan len mỏng',       80,  0,115.00, 9200.00,2);

-- ── Chặng vận chuyển ─────────────────────────────────────────────────────────
INSERT IGNORE INTO shipments (id, code, leg, carrier_id, payer, charge_mode, rate_per_kg_cny, flat_cost, currency, fx_rate, total_weight_kg, total_cost_vnd, dispatched_at, arrived_at, notes, created_by) VALUES
  ('ff000001-0000-0000-0000-000000000001','SHP000001','cn_to_vn','cc000001-0000-0000-0000-000000000001','we_pay_now','flat',0.00,3800.00,'CNY',3580.00,258.00,13604000,DATE_SUB(NOW(),INTERVAL 55 DAY),DATE_SUB(NOW(),INTERVAL 43 DAY),'Chặng CN→VN cho PO000001',@uid_kho1),
  ('ff000001-0000-0000-0000-000000000002','SHP000002','cn_to_vn','cc000001-0000-0000-0000-000000000001','we_pay_now','flat',0.00,4200.00,'CNY',3600.00,308.00,15120000,DATE_SUB(NOW(),INTERVAL 40 DAY),DATE_SUB(NOW(),INTERVAL 28 DAY),'Chặng CN→VN cho PO000002',@uid_kho1);

INSERT IGNORE INTO shipment_items (id, shipment_id, po_id, po_item_id, product_id, product_name_snapshot, quantity, weight_kg, alloc_cost_vnd, alloc_unit_vnd) VALUES
  (UUID(),'ff000001-0000-0000-0000-000000000001','ee000001-0000-0000-0000-000000000001','ef000001-0000-0000-0000-000000000001','dd000001-0000-0000-0000-000000000001','Áo thun basic unisex',      200, 40.00,2096000,10480),
  (UUID(),'ff000001-0000-0000-0000-000000000001','ee000001-0000-0000-0000-000000000001','ef000001-0000-0000-0000-000000000002','dd000001-0000-0000-0000-000000000002','Áo thun in hình local brand',150, 31.50,1571000,10473),
  (UUID(),'ff000001-0000-0000-0000-000000000001','ee000001-0000-0000-0000-000000000001','ef000001-0000-0000-0000-000000000003','dd000001-0000-0000-0000-000000000008','Áo khoác bomber',            80, 48.00,2393000,29913),
  (UUID(),'ff000001-0000-0000-0000-000000000002','ee000001-0000-0000-0000-000000000002','ef000001-0000-0000-0000-000000000004','dd000001-0000-0000-0000-000000000003','Quần jean slim fit nam',    120, 78.00,4679000,38992),
  (UUID(),'ff000001-0000-0000-0000-000000000002','ee000001-0000-0000-0000-000000000002','ef000001-0000-0000-0000-000000000005','dd000001-0000-0000-0000-000000000004','Quần jean skinny nữ',       100, 58.00,3477000,34770),
  (UUID(),'ff000001-0000-0000-0000-000000000002','ee000001-0000-0000-0000-000000000002','ef000001-0000-0000-0000-000000000006','dd000001-0000-0000-0000-000000000019','Quần jeans bô (baggy)',       80, 56.00,3359000,41988);

-- ── Lô tồn kho ───────────────────────────────────────────────────────────────
INSERT IGNORE INTO inventory_lots (id, product_id, po_item_id, lot_code, qty_total, qty_available, goods_unit_cost, ship_unit_cost, is_negative) VALUES
  ('ab000001-0000-0000-0000-000000000001','dd000001-0000-0000-0000-000000000001','ef000001-0000-0000-0000-000000000001','LOT-PO000001-AT-BASIC', 200,120,125300.0000, 8500.0000,0),
  ('ab000001-0000-0000-0000-000000000002','dd000001-0000-0000-0000-000000000002','ef000001-0000-0000-0000-000000000002','LOT-PO000001-AT-PRINT', 150,130,161100.0000,10200.0000,0),
  ('ab000001-0000-0000-0000-000000000003','dd000001-0000-0000-0000-000000000008','ef000001-0000-0000-0000-000000000003','LOT-PO000001-AK-BOMB',   80, 80,590700.0000,35400.0000,0),
  ('ab000001-0000-0000-0000-000000000004','dd000001-0000-0000-0000-000000000003','ef000001-0000-0000-0000-000000000004','LOT-PO000002-QJ-SLIM-M',120,120,340100.0000,38992.0000,0),
  ('ab000001-0000-0000-0000-000000000005','dd000001-0000-0000-0000-000000000004','ef000001-0000-0000-0000-000000000005','LOT-PO000002-QJ-SKIN-F',100,100,316800.0000,34770.0000,0),
  ('ab000001-0000-0000-0000-000000000006','dd000001-0000-0000-0000-000000000019','ef000001-0000-0000-0000-000000000006','LOT-PO000002-QJ-BO',     80, 60,352800.0000,41988.0000,0);

-- ── Đơn bán hàng ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO sales_orders (id, code, customer_id, order_date, delivery_date, delivery_address, subtotal, discount_amount, shipping_fee, total, paid_amount, delivered_amount, status, payment_status, notes, created_by, approved_by, approved_at) VALUES
  ('ba000001-0000-0000-0000-000000000001','SO000001','bb000001-0000-0000-0000-000000000001',DATE_SUB(CURDATE(),INTERVAL 35 DAY),DATE_SUB(CURDATE(),INTERVAL 30 DAY),'45 Nguyễn Huệ, Q1, TP.HCM',14000000,500000,200000,13700000,13700000,13700000,'completed','paid','Đơn tháng 10 — giao nhanh',@uid_sale1,@uid_manager,DATE_SUB(NOW(),INTERVAL 35 DAY)),
  ('ba000001-0000-0000-0000-000000000002','SO000002','bb000001-0000-0000-0000-000000000002',DATE_SUB(CURDATE(),INTERVAL 25 DAY),DATE_SUB(CURDATE(),INTERVAL 18 DAY),'12 Hàng Bài, Hoàn Kiếm, Hà Nội',15300000,0,0,15300000,8000000,15300000,'delivered','partial',NULL,@uid_sale2,@uid_manager,DATE_SUB(NOW(),INTERVAL 25 DAY)),
  ('ba000001-0000-0000-0000-000000000003','SO000003','bb000001-0000-0000-0000-000000000003',DATE_SUB(CURDATE(),INTERVAL 10 DAY),DATE_ADD(CURDATE(),INTERVAL 5 DAY),'88 Lê Lợi, Q1, TP.HCM',26900000,900000,300000,26300000,0,0,'approved','unpaid','Đơn sỉ lớn — ưu tiên giao trước Tết',@uid_sale1,@uid_manager,DATE_SUB(NOW(),INTERVAL 9 DAY)),
  ('ba000001-0000-0000-0000-000000000004','SO000004','bb000001-0000-0000-0000-000000000006',DATE_SUB(CURDATE(),INTERVAL 3 DAY),NULL,NULL,53300000,1300000,500000,52500000,0,0,'pending_approval','unpaid','Đơn lớn cuối năm — cần duyệt',@uid_sale2,NULL,NULL),
  ('ba000001-0000-0000-0000-000000000005','SO000005','bb000001-0000-0000-0000-000000000007',DATE_SUB(CURDATE(),INTERVAL 7 DAY),DATE_ADD(CURDATE(),INTERVAL 3 DAY),'8 Hàng Ngang, Hoàn Kiếm, Hà Nội',11500000,0,150000,11650000,5000000,0,'approved','partial',NULL,@uid_sale1,@uid_sale1,DATE_SUB(NOW(),INTERVAL 7 DAY)),
  ('ba000001-0000-0000-0000-000000000006','SO000006','bb000001-0000-0000-0000-000000000015',CURDATE(),NULL,NULL,9950000,0,0,9950000,0,0,'draft','unpaid','Đơn nháp — cần xác nhận lại số lượng',@uid_sale2,NULL,NULL);

-- ── Dòng đơn bán ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO sales_order_items (id, order_id, product_id, product_name_snapshot, quantity, delivered_qty, unit_price, discount_pct, line_total, sort_order) VALUES
  ('bc000001-0000-0000-0000-000000000001','ba000001-0000-0000-0000-000000000001','dd000001-0000-0000-0000-000000000001','Áo thun basic unisex',      50,50,165000,5.0, 7837500,0),
  ('bc000001-0000-0000-0000-000000000002','ba000001-0000-0000-0000-000000000001','dd000001-0000-0000-0000-000000000002','Áo thun in hình local brand',30,30,220000,0.0, 6600000,1),
  ('bc000001-0000-0000-0000-000000000003','ba000001-0000-0000-0000-000000000002','dd000001-0000-0000-0000-000000000003','Quần jean slim fit nam',     20,20,450000,0.0, 9000000,0),
  ('bc000001-0000-0000-0000-000000000004','ba000001-0000-0000-0000-000000000002','dd000001-0000-0000-0000-000000000004','Quần jean skinny nữ',        15,15,420000,0.0, 6300000,1),
  ('bc000001-0000-0000-0000-000000000005','ba000001-0000-0000-0000-000000000003','dd000001-0000-0000-0000-000000000001','Áo thun basic unisex',       50, 0,158000,4.0, 7584000,0),
  ('bc000001-0000-0000-0000-000000000006','ba000001-0000-0000-0000-000000000003','dd000001-0000-0000-0000-000000000019','Quần jeans bô (baggy)',       20, 0,450000,0.0, 9000000,1),
  ('bc000001-0000-0000-0000-000000000007','ba000001-0000-0000-0000-000000000003','dd000001-0000-0000-0000-000000000008','Áo khoác bomber',             13, 0,780000,0.0,10140000,2),
  ('bc000001-0000-0000-0000-000000000008','ba000001-0000-0000-0000-000000000004','dd000001-0000-0000-0000-000000000008','Áo khoác bomber',             50, 0,750000,0.0,37500000,0),
  ('bc000001-0000-0000-0000-000000000009','ba000001-0000-0000-0000-000000000004','dd000001-0000-0000-0000-000000000001','Áo thun basic unisex',       100, 0,158000,0.0,15800000,1),
  ('bc000001-0000-0000-0000-000000000010','ba000001-0000-0000-0000-000000000005','dd000001-0000-0000-0000-000000000003','Quần jean slim fit nam',      15, 0,430000,0.0, 6450000,0),
  ('bc000001-0000-0000-0000-000000000011','ba000001-0000-0000-0000-000000000005','dd000001-0000-0000-0000-000000000004','Quần jean skinny nữ',         12, 0,400000,0.0, 4800000,1),
  ('bc000001-0000-0000-0000-000000000012','ba000001-0000-0000-0000-000000000006','dd000001-0000-0000-0000-000000000001','Áo thun basic unisex',        30, 0,165000,5.0, 4703250,0),
  ('bc000001-0000-0000-0000-000000000013','ba000001-0000-0000-0000-000000000006','dd000001-0000-0000-0000-000000000002','Áo thun in hình local brand', 24, 0,220000,0.0, 5280000,1);

-- ── Phê duyệt ────────────────────────────────────────────────────────────────
INSERT IGNORE INTO approvals (id, entity_type, entity_id, entity_code, reason, amount, requested_by, status) VALUES
  (UUID(),'sales_order','ba000001-0000-0000-0000-000000000004','SO000004','Đơn vượt ngưỡng phê duyệt 50,000,000 VND',52500000,@uid_sale2,'pending');

-- ── Thu chi tiền mặt ─────────────────────────────────────────────────────────
INSERT IGNORE INTO cash_transactions (id, code, transaction_date, transaction_type, account, category, amount_vnd, currency, payment_method, reference_type, reference_code, counterparty_name, customer_id, supplier_id, description, status, created_by, approved_by, approved_at) VALUES
  ('ca000001-0000-0000-0000-000000000001','THU000001',DATE_SUB(CURDATE(),INTERVAL 30 DAY),'income','bank','Tiền hàng',13700000,'VND','transfer','sales_order','SO000001','Shop Thời Trang Linh','bb000001-0000-0000-0000-000000000001',NULL,'Thanh toán đơn SO000001','approved',@uid_ktlead,@uid_ktlead,DATE_SUB(NOW(),INTERVAL 30 DAY)),
  ('ca000001-0000-0000-0000-000000000002','THU000002',DATE_SUB(CURDATE(),INTERVAL 18 DAY),'income','bank','Tiền hàng', 8000000,'VND','transfer','sales_order','SO000002','Boutique Mỹ Duyên',  'bb000001-0000-0000-0000-000000000002',NULL,'Tạm ứng 8 triệu SO000002','approved',@uid_ktlead,@uid_ktlead,DATE_SUB(NOW(),INTERVAL 18 DAY)),
  ('ca000001-0000-0000-0000-000000000003','THU000003',DATE_SUB(CURDATE(),INTERVAL  6 DAY),'income','main','Tiền hàng', 5000000,'VND','cash',    'sales_order','SO000005','Hà Nội Style Boutique','bb000001-0000-0000-0000-000000000007',NULL,'Thu tiền mặt cọc 50% SO000005','approved',@uid_sale1,@uid_ktlead,DATE_SUB(NOW(),INTERVAL 6 DAY)),
  ('ca000001-0000-0000-0000-000000000004','CHI000001',DATE_SUB(CURDATE(),INTERVAL 58 DAY),'expense','bank','Thanh toán NCC',99345000,'VND','transfer','purchase_order','PO000001','Guangzhou Fashion Hub',NULL,'aa000001-0000-0000-0000-000000000001','Thanh toán 100% PO000001','approved',@uid_owner,@uid_owner,DATE_SUB(NOW(),INTERVAL 58 DAY)),
  ('ca000001-0000-0000-0000-000000000005','CHI000002',DATE_SUB(CURDATE(),INTERVAL 44 DAY),'expense','bank','Thanh toán NCC',54000000,'VND','transfer','purchase_order','PO000002','Foshan Denim World',NULL,'aa000001-0000-0000-0000-000000000004','Cọc 50% PO000002','approved',@uid_owner,@uid_owner,DATE_SUB(NOW(),INTERVAL 44 DAY)),
  ('ca000001-0000-0000-0000-000000000006','CHI000003',DATE_SUB(CURDATE(),INTERVAL 20 DAY),'expense','bank','Chi phí hoạt động',18000000,'VND','transfer',NULL,NULL,'Chủ nhà kho Bình Dương',NULL,NULL,'Thuê kho 300m² tháng 11/2024','approved',@uid_owner,@uid_owner,DATE_SUB(NOW(),INTERVAL 20 DAY)),
  ('ca000001-0000-0000-0000-000000000007','CHI000004',DATE_SUB(CURDATE(),INTERVAL  5 DAY),'expense','bank','Lương & BHXH',52000000,'VND','transfer',NULL,NULL,NULL,NULL,NULL,'Lương 8 nhân viên tháng 11/2024','pending',@uid_ktlead,NULL,NULL),
  ('ca000001-0000-0000-0000-000000000008','CHI000005',DATE_SUB(CURDATE(),INTERVAL 12 DAY),'expense','main','Marketing', 8500000,'VND','transfer',NULL,NULL,'Meta Ads Vietnam',NULL,NULL,'Chạy quảng cáo Facebook/Instagram tháng 11','approved',@uid_manager,@uid_owner,DATE_SUB(NOW(),INTERVAL 12 DAY)),
  ('ca000001-0000-0000-0000-000000000009','THU000004',DATE_SUB(CURDATE(),INTERVAL  8 DAY),'income','bank','Chiết khấu NCC', 4500000,'VND','transfer',NULL,NULL,'Guangzhou Fashion Hub',NULL,'aa000001-0000-0000-0000-000000000001','CK cuối quý Q3','approved',@uid_ktlead,@uid_ktlead,DATE_SUB(NOW(),INTERVAL 8 DAY)),
  ('ca000001-0000-0000-0000-000000000010','CHI000006',DATE_SUB(CURDATE(),INTERVAL 15 DAY),'expense','main','Chi phí hoạt động',2800000,'VND','cash',NULL,NULL,'EVN TP.HCM',NULL,NULL,'Hóa đơn điện văn phòng tháng 11','approved',@uid_ktlead,@uid_ktlead,DATE_SUB(NOW(),INTERVAL 15 DAY));

-- ── Cơ hội bán hàng ──────────────────────────────────────────────────────────
INSERT IGNORE INTO deals (id, code, title, customer_id, customer_name_snapshot, stage, estimated_value, probability_pct, expected_close_date, assigned_to, next_action, next_action_date, notes, created_by) VALUES
  ('da000001-0000-0000-0000-000000000001','DEAL000001','Hợp đồng cung cấp Q1/2025 — 365 Fashion','bb000001-0000-0000-0000-000000000003','Cửa hàng 365 Fashion','proposal',120000000,60,DATE_ADD(CURDATE(),INTERVAL 45 DAY),@uid_sale1,'Gửi bảng báo giá chi tiết + catalogue mới',DATE_ADD(CURDATE(),INTERVAL 3 DAY),'KH đã ngỏ ý muốn ký HĐ dài hạn Q1.',@uid_sale1),
  ('da000001-0000-0000-0000-000000000002','DEAL000002','Phân phối độc quyền khu vực Cần Thơ','bb000001-0000-0000-0000-000000000005','Shop Áo Đẹp Cần Thơ','qualified',200000000,35,DATE_ADD(CURDATE(),INTERVAL 90 DAY),@uid_manager,'Gặp mặt trực tiếp tại Cần Thơ',DATE_ADD(CURDATE(),INTERVAL 14 DAY),'KH có tiềm năng scale lớn nếu có độc quyền.',@uid_sale1),
  ('da000001-0000-0000-0000-000000000003','DEAL000003','Mở rộng danh mục hàng VIP — Mia Fashion','bb000001-0000-0000-0000-000000000006','Mia Fashion Store','negotiation',85000000,75,DATE_ADD(CURDATE(),INTERVAL 20 DAY),@uid_sale2,'Chốt giá sỉ cho dòng áo dài cách tân',DATE_ADD(CURDATE(),INTERVAL 2 DAY),'KH muốn thêm áo dài CT và đầm tiệc.',@uid_sale2),
  ('da000001-0000-0000-0000-000000000004','DEAL000004','Kênh phân phối TikTok Shop — Trendy Online','bb000001-0000-0000-0000-000000000015','Trendy Online Store','new',150000000,20,DATE_ADD(CURDATE(),INTERVAL 60 DAY),@uid_sale1,'Tìm hiểu nhu cầu TikTok Shop',DATE_ADD(CURDATE(),INTERVAL 7 DAY),'KH bán hàng online. Tiềm năng cao.',@uid_sale1),
  ('da000001-0000-0000-0000-000000000005','DEAL000005','Ký HĐ sỉ thường xuyên — Boutique Minh Phương','bb000001-0000-0000-0000-000000000013','Boutique Minh Phương','won',95000000,100,DATE_SUB(CURDATE(),INTERVAL 5 DAY),@uid_sale2,NULL,NULL,'Đã ký HĐ. Đơn đầu tiên SO000005 đang xử lý.',@uid_sale2),
  ('da000001-0000-0000-0000-000000000006','DEAL000006','Đại lý mới khu vực Hải Phòng','bb000001-0000-0000-0000-000000000012','Cửa Hàng Xinh Đẹp','lost',60000000,0,DATE_SUB(CURDATE(),INTERVAL 10 DAY),@uid_sale1,NULL,NULL,'KH chọn nhà cung cấp khác giá thấp hơn.',@uid_sale1);

-- ── Log xuất kho ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO delivery_lot_lines (id, order_id, order_item_id, product_id, lot_id, qty, goods_unit_cost, ship_unit_cost) VALUES
  (UUID(),'ba000001-0000-0000-0000-000000000001','bc000001-0000-0000-0000-000000000001','dd000001-0000-0000-0000-000000000001','ab000001-0000-0000-0000-000000000001', 50,125300.0000, 8500.0000),
  (UUID(),'ba000001-0000-0000-0000-000000000001','bc000001-0000-0000-0000-000000000002','dd000001-0000-0000-0000-000000000002','ab000001-0000-0000-0000-000000000002', 30,161100.0000,10200.0000),
  (UUID(),'ba000001-0000-0000-0000-000000000002','bc000001-0000-0000-0000-000000000003','dd000001-0000-0000-0000-000000000003','ab000001-0000-0000-0000-000000000004', 20,340100.0000,38992.0000),
  (UUID(),'ba000001-0000-0000-0000-000000000002','bc000001-0000-0000-0000-000000000004','dd000001-0000-0000-0000-000000000004','ab000001-0000-0000-0000-000000000005', 15,316800.0000,34770.0000);

-- ── Đồng bộ tồn kho & bộ đếm mã ─────────────────────────────────────────────
UPDATE products SET current_stock = (
  SELECT COALESCE(SUM(qty_available), 0) FROM inventory_lots
  WHERE inventory_lots.product_id = products.id AND is_negative = 0
);

INSERT INTO code_sequences (prefix, last_val) VALUES
  ('SO',6),('PO',3),('SHP',2),('DEAL',6),('THU',4),('CHI',6),('LOT',6),('NCC',6),('KH',15),('MAU',0)
ON DUPLICATE KEY UPDATE last_val = VALUES(last_val);
