-- ============================================================
-- CREAMEE ERP — Migration 008
-- HR: employees + payroll_entries + KPI tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS employees (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  code            VARCHAR(20)   NOT NULL UNIQUE,
  full_name       VARCHAR(255)  NOT NULL,
  phone           VARCHAR(20)   NULL,
  email           VARCHAR(255)  NULL,
  position        VARCHAR(100)  NULL,   -- VD: Kho, Sales, Kế toán
  department      VARCHAR(100)  NULL,
  base_salary_vnd DECIMAL(18,2) NOT NULL DEFAULT 0,
  -- Ngân hàng nhận lương
  bank_name       VARCHAR(100)  NULL,
  bank_account    VARCHAR(50)   NULL,
  -- Profile link (nếu có tài khoản hệ thống)
  profile_id      VARCHAR(36)   NULL,
  hire_date       DATE          NULL,
  terminate_date  DATE          NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  notes           TEXT          NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_emp_active (is_active),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payroll_entries (
  id                  VARCHAR(36)   NOT NULL PRIMARY KEY,
  employee_id         VARCHAR(36)   NOT NULL,
  year                SMALLINT      NOT NULL,
  month               TINYINT       NOT NULL,
  -- Lương cơ bản
  base_salary_vnd     DECIMAL(18,2) NOT NULL DEFAULT 0,
  -- Phụ cấp + thưởng
  allowance_vnd       DECIMAL(18,2) NOT NULL DEFAULT 0,
  bonus_vnd           DECIMAL(18,2) NOT NULL DEFAULT 0,
  -- Khấu trừ (BHXH, thuế, ...)
  deduction_vnd       DECIMAL(18,2) NOT NULL DEFAULT 0,
  -- Thực lãnh
  net_salary_vnd      DECIMAL(18,2) GENERATED ALWAYS AS
                      (base_salary_vnd + allowance_vnd + bonus_vnd - deduction_vnd) STORED,
  -- KPI
  kpi_orders_handled  INT           NOT NULL DEFAULT 0,  -- Số đơn xử lý
  kpi_defect_rate_pct DECIMAL(5,2)  NOT NULL DEFAULT 0,  -- % hàng lỗi (kho)
  kpi_notes           TEXT          NULL,
  -- Trạng thái
  status              ENUM('draft','approved','paid') NOT NULL DEFAULT 'draft',
  paid_at             DATETIME      NULL,
  approved_by         VARCHAR(36)   NULL,
  notes               TEXT          NULL,
  created_by          VARCHAR(36)   NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                      ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payroll_emp_ym (employee_id, year, month),
  INDEX idx_payroll_ym (year, month),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed code sequence cho employee
INSERT INTO code_sequences (prefix, last_val)
VALUES ('EMP', 0)
ON DUPLICATE KEY UPDATE prefix = prefix;
