-- ============================================================
-- CREAMEE ERP — Migration 004
-- Bảng product_variants: màu + size + SKU + ảnh (tối đa 10)
-- An toàn re-run: IF NOT EXISTS + procedure check index/col
-- ============================================================

-- ── Bảng variants ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id              VARCHAR(36)    NOT NULL PRIMARY KEY,
  product_id      VARCHAR(36)    NOT NULL,
  sku             VARCHAR(100)   NOT NULL UNIQUE,
  color           VARCHAR(100)   NULL,
  size            VARCHAR(50)    NULL,
  barcode         VARCHAR(100)   NULL,
  cost_cny        DECIMAL(18,4)  NOT NULL DEFAULT 0,
  cost_vnd        DECIMAL(18,2)  NOT NULL DEFAULT 0,
  price_vnd       DECIMAL(18,2)  NOT NULL DEFAULT 0,
  current_stock   INT            NOT NULL DEFAULT 0,
  -- JSON array tối đa 10 URL ảnh: ["/uploads/variants/xxx/1.jpg", ...]
  image_urls      JSON           NULL,
  notes           TEXT           NULL,
  is_active       TINYINT(1)     NOT NULL DEFAULT 1,
  created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pv_product  (product_id),
  INDEX idx_pv_sku      (sku),
  INDEX idx_pv_active   (is_active),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Helper: thêm cột nếu chưa tồn tại ───────────────────────
DROP PROCEDURE IF EXISTS _m004_add_col;
DELIMITER //
CREATE PROCEDURE _m004_add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
BEGIN
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = tbl
        AND COLUMN_NAME  = col) = 0 THEN
    SET @ddl := CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
    PREPARE _s FROM @ddl;
    EXECUTE _s;
    DEALLOCATE PREPARE _s;
  END IF;
END //
DELIMITER ;

-- Thêm variant_id vào sales_order_items (nullable — tương thích đơn cũ)
CALL _m004_add_col('sales_order_items', 'variant_id',
  'VARCHAR(36) NULL AFTER product_id');

-- Thêm variant_id vào purchase_order_items
CALL _m004_add_col('purchase_order_items', 'variant_id',
  'VARCHAR(36) NULL AFTER product_id');

-- Thêm variant_id vào inventory_lots
CALL _m004_add_col('inventory_lots', 'variant_id',
  'VARCHAR(36) NULL AFTER product_id');

DROP PROCEDURE IF EXISTS _m004_add_col;

-- ── Helper: thêm index nếu chưa tồn tại ─────────────────────
DROP PROCEDURE IF EXISTS _m004_add_idx;
DELIMITER //
CREATE PROCEDURE _m004_add_idx(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN col TEXT)
BEGIN
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = tbl
        AND INDEX_NAME   = idx) = 0 THEN
    SET @ddl := CONCAT('ALTER TABLE `', tbl, '` ADD INDEX `', idx, '` (', col, ')');
    PREPARE _s FROM @ddl;
    EXECUTE _s;
    DEALLOCATE PREPARE _s;
  END IF;
END //
DELIMITER ;

CALL _m004_add_idx('sales_order_items',    'idx_soi_variant', 'variant_id');
CALL _m004_add_idx('purchase_order_items', 'idx_poi_variant', 'variant_id');
CALL _m004_add_idx('inventory_lots',       'idx_il_variant',  'variant_id');

DROP PROCEDURE IF EXISTS _m004_add_idx;
