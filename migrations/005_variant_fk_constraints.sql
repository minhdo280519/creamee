-- ============================================================
-- CREAMEE ERP — Migration 005
-- Thêm FK constraints cho variant_id (đã thêm col ở migration 004)
-- An toàn re-run: check tồn tại trước khi thêm
-- ============================================================

DROP PROCEDURE IF EXISTS _m005_add_fk;
DELIMITER //
CREATE PROCEDURE _m005_add_fk(
  IN tbl      VARCHAR(64),
  IN fk_name  VARCHAR(64),
  IN fk_col   VARCHAR(64),
  IN ref_tbl  VARCHAR(64),
  IN ref_col  VARCHAR(64)
)
BEGIN
  IF (SELECT COUNT(*)
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA    = DATABASE()
        AND TABLE_NAME      = tbl
        AND CONSTRAINT_NAME = fk_name
        AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0 THEN
    SET @ddl := CONCAT(
      'ALTER TABLE `', tbl, '` ADD CONSTRAINT `', fk_name, '` ',
      'FOREIGN KEY (`', fk_col, '`) REFERENCES `', ref_tbl, '`(`', ref_col, '`) ',
      'ON DELETE SET NULL'
    );
    PREPARE _s FROM @ddl;
    EXECUTE _s;
    DEALLOCATE PREPARE _s;
  END IF;
END //
DELIMITER ;

CALL _m005_add_fk('sales_order_items',    'fk_soi_variant',  'variant_id', 'product_variants', 'id');
CALL _m005_add_fk('purchase_order_items', 'fk_poi_variant',  'variant_id', 'product_variants', 'id');
CALL _m005_add_fk('inventory_lots',       'fk_il_variant',   'variant_id', 'product_variants', 'id');

DROP PROCEDURE IF EXISTS _m005_add_fk;
