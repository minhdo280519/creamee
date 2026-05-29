-- ============================================================
-- CREAMEE ERP — Migration 006
-- Defect management + QC 3-số trên purchase_order_items
-- Xử lý: return_supplier / liquidation / discount / gift / keep
-- ============================================================

-- ── Thêm QC columns vào purchase_order_items ────────────────
DROP PROCEDURE IF EXISTS _m006_add_col;
DELIMITER //
CREATE PROCEDURE _m006_add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
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

-- NCC báo số lượng
CALL _m006_add_col('purchase_order_items', 'qty_reported',
  'INT NOT NULL DEFAULT 0 COMMENT "NCC báo"');

-- Thực nhận (có thể khác NCC báo do giao thiếu/thừa)
CALL _m006_add_col('purchase_order_items', 'qty_actual_received',
  'INT NOT NULL DEFAULT 0 COMMENT "Thực nhận"');

-- Số lượng tốt sau QC (= actual_received - defective)
CALL _m006_add_col('purchase_order_items', 'qty_good',
  'INT NOT NULL DEFAULT 0 COMMENT "Good sau QC"');

-- Ghi chú QC
CALL _m006_add_col('purchase_order_items', 'qc_notes',
  'TEXT NULL');

-- Ngày QC hoàn tất
CALL _m006_add_col('purchase_order_items', 'qc_done_at',
  'DATETIME NULL');

DROP PROCEDURE IF EXISTS _m006_add_col;

-- ── Bảng defects ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS defects (
  id                VARCHAR(36)   NOT NULL PRIMARY KEY,
  po_id             VARCHAR(36)   NOT NULL,
  po_item_id        VARCHAR(36)   NOT NULL,
  product_id        VARCHAR(36)   NOT NULL,
  variant_id        VARCHAR(36)   NULL,
  -- Phân loại lỗi
  defect_reason     VARCHAR(255)  NOT NULL
                    COMMENT 'VD: Sai màu, Đứt chỉ, Lỗi dệt, Ố bẩn...',
  quantity          INT           NOT NULL DEFAULT 1,
  -- Cách xử lý
  handling_method   ENUM(
    'return_supplier',  -- Trả về NCC
    'liquidation',      -- Thanh lý giá thấp
    'discount',         -- Bán giảm giá
    'gift',             -- Tặng khách
    'keep'              -- Giữ lại (lỗi nhỏ, vẫn dùng được)
  ) NOT NULL DEFAULT 'keep',
  handling_notes    TEXT          NULL,
  -- Giá trị tổn thất ước tính
  loss_vnd          DECIMAL(18,2) NOT NULL DEFAULT 0,
  -- Trạng thái xử lý
  is_resolved       TINYINT(1)    NOT NULL DEFAULT 0,
  resolved_at       DATETIME      NULL,
  resolved_by       VARCHAR(36)   NULL,
  image_urls        JSON          NULL COMMENT 'Ảnh lỗi, tối đa 5',
  created_by        VARCHAR(36)   NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_defects_po        (po_id),
  INDEX idx_defects_product   (product_id),
  INDEX idx_defects_variant   (variant_id),
  INDEX idx_defects_resolved  (is_resolved),
  FOREIGN KEY (po_id)      REFERENCES purchase_orders(id)      ON DELETE CASCADE,
  FOREIGN KEY (po_item_id) REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)             ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
