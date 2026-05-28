-- ============================================================
-- Migration 002 — thêm status 'processing' vào sales_orders
--                + cột so_id/so_code vào purchase_order_items
-- Re-run an toàn.
-- ============================================================

-- 1. Thêm 'processing' vào ENUM status sales_orders
ALTER TABLE sales_orders
  MODIFY COLUMN status ENUM(
    'draft','pending_approval','approved','processing',
    'partial_paid','paid','partial_delivered','delivered','completed','cancelled'
  ) NOT NULL DEFAULT 'draft';

-- 2. Thêm cột so_id, so_code vào purchase_order_items nếu chưa có
DROP PROCEDURE IF EXISTS _m002_add_col;
DELIMITER //
CREATE PROCEDURE _m002_add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
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

CALL _m002_add_col('purchase_order_items', 'so_id',   'VARCHAR(36) NULL');
CALL _m002_add_col('purchase_order_items', 'so_code', 'VARCHAR(50) NULL');

DROP PROCEDURE IF EXISTS _m002_add_col;
