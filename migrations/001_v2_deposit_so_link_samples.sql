-- ============================================================
-- CREAMEE ERP v7 — Migration 001 (= migrate-v2.sql cũ)
-- An toàn re-run nhờ IF NOT EXISTS / ON DUPLICATE KEY UPDATE.
-- ============================================================

-- 1. Đơn bán hàng: thêm tiền cọc từ khách
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(18,2) NOT NULL DEFAULT 0
  AFTER paid_amount;

-- 2. Đơn nhập hàng: gắn với đơn bán hàng tương ứng
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS so_id   VARCHAR(36) NULL AFTER supplier_id;
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS so_code VARCHAR(50) NULL AFTER so_id;

-- 3. Vận chuyển: mã vận đơn + gắn với SO
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(200) NULL AFTER code;
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS so_id   VARCHAR(36) NULL AFTER tracking_number;
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS so_code VARCHAR(50)  NULL AFTER so_id;

-- Thêm loại chặng giao hàng tới khách
ALTER TABLE shipments
  MODIFY COLUMN leg ENUM('cn_domestic','cn_to_vn','vn_domestic','vn_to_customer') NOT NULL;

-- 4. Sản phẩm: thêm trường ảnh chính (ngoài image_urls JSON đã có)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) NULL AFTER description;

-- 5. Bảng quản lý mẫu
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

INSERT INTO code_sequences (prefix, last_val) VALUES ('MAU', 0)
ON DUPLICATE KEY UPDATE last_val = last_val;
