-- ============================================================
-- CREAMEE ERP v7 — Migration 001 (= migrate-v2.sql cũ)
-- An toàn re-run: dùng INFORMATION_SCHEMA để check tồn tại.
-- Tương thích MySQL 5.7+ / MariaDB (không cần 8.0.29 IF NOT EXISTS).
-- ============================================================

-- ── Helper: thêm cột nếu chưa tồn tại ────────────────────────
DROP PROCEDURE IF EXISTS _migrate_add_col;
DELIMITER //
CREATE PROCEDURE _migrate_add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
BEGIN
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = tbl
        AND COLUMN_NAME = col) = 0 THEN
    SET @ddl := CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
    PREPARE _s FROM @ddl;
    EXECUTE _s;
    DEALLOCATE PREPARE _s;
  END IF;
END //
DELIMITER ;

-- 1. Đơn bán hàng: tiền cọc từ khách
CALL _migrate_add_col('sales_orders',    'deposit_amount',  'DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER paid_amount');

-- 2. Đơn nhập hàng: gắn với đơn bán hàng tương ứng
CALL _migrate_add_col('purchase_orders', 'so_id',           'VARCHAR(36) NULL AFTER supplier_id');
CALL _migrate_add_col('purchase_orders', 'so_code',         'VARCHAR(50) NULL AFTER so_id');

-- 3. Vận chuyển: mã vận đơn + gắn với SO
CALL _migrate_add_col('shipments',       'tracking_number', 'VARCHAR(200) NULL AFTER code');
CALL _migrate_add_col('shipments',       'so_id',           'VARCHAR(36) NULL AFTER tracking_number');
CALL _migrate_add_col('shipments',       'so_code',         'VARCHAR(50)  NULL AFTER so_id');

-- 4. Sản phẩm: thêm trường ảnh chính (ngoài image_urls JSON đã có)
CALL _migrate_add_col('products',        'image_url',       'VARCHAR(500) NULL AFTER description');

-- Dọn helper
DROP PROCEDURE IF EXISTS _migrate_add_col;

-- ── Thêm loại chặng giao hàng tới khách ──────────────────────
-- MODIFY COLUMN: an toàn re-run (không lỗi nếu đã đúng định nghĩa)
ALTER TABLE shipments
  MODIFY COLUMN leg ENUM('cn_domestic','cn_to_vn','vn_domestic','vn_to_customer') NOT NULL;

-- ── Bảng quản lý mẫu ─────────────────────────────────────────
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
