-- ============================================================
-- CREAMEE ERP v7 — Migration 003
-- Tạo bảng leads (CRM tiền bán hàng) + index tìm kiếm
-- An toàn re-run: dùng IF NOT EXISTS + procedure check index
-- ============================================================

CREATE TABLE IF NOT EXISTS leads (
  id          VARCHAR(36)  NOT NULL PRIMARY KEY,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  name        VARCHAR(255) NOT NULL,
  phone       VARCHAR(20)  NULL,
  email       VARCHAR(255) NULL,
  city        VARCHAR(100) NULL,
  source      VARCHAR(50)  NULL DEFAULT 'Facebook Ads',
  need        TEXT         NULL,
  status      ENUM('new','consulting','quoted','won','lost')
              NOT NULL DEFAULT 'new',
  assigned_to_email VARCHAR(255) NULL,
  customer_id VARCHAR(36)  NULL,
  notes       TEXT         NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
              ON UPDATE CURRENT_TIMESTAMP
);

-- Thêm index an toàn (không lỗi nếu đã tồn tại)
DROP PROCEDURE IF EXISTS _migrate_add_idx;
DELIMITER //
CREATE PROCEDURE _migrate_add_idx(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN col TEXT)
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

CALL _migrate_add_idx('leads', 'idx_leads_status', 'status');
CALL _migrate_add_idx('leads', 'idx_leads_name',   'name');

DROP PROCEDURE IF EXISTS _migrate_add_idx;

-- Seed sequence counter (không reset nếu đã có)
INSERT INTO code_sequences (prefix, last_val)
VALUES ('LEAD', 0)
ON DUPLICATE KEY UPDATE prefix = prefix;
