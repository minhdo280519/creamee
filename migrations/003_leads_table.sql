-- ============================================================
-- CREAMEE ERP v7 — Migration 003
-- Tạo bảng leads (CRM tiền bán hàng) + index tìm kiếm
-- An toàn re-run: dùng CREATE TABLE IF NOT EXISTS
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
  customer_id VARCHAR(36)  NULL,         -- gắn KH sau khi chuyển đổi
  notes       TEXT         NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
              ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_name   ON leads (name);

-- Seed sequence counter (không reset nếu đã có)
INSERT INTO code_sequences (prefix, last_val)
VALUES ('LEAD', 0)
ON DUPLICATE KEY UPDATE prefix = prefix;
