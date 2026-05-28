# Migrations

Mỗi thay đổi DB sau khi đã deploy → tạo 1 file mới ở đây.

## Quy tắc đặt tên
`NNN_mo_ta_ngan.sql` — ví dụ: `002_them_bang_promotion.sql`. Số tăng dần, không trùng.

## Quy tắc viết SQL (idempotent — chạy nhiều lần không lỗi)
- `CREATE TABLE IF NOT EXISTS ...` ✅ mọi version
- `INSERT ... ON DUPLICATE KEY UPDATE ...` (thay cho INSERT thường) ✅
- `ALTER TABLE ... MODIFY COLUMN ...` — re-run cùng định nghĩa không lỗi ✅
- **KHÔNG dùng `ADD COLUMN IF NOT EXISTS`** — chỉ có từ MySQL 8.0.29, VPS có thể cũ hơn.
  Thay vào đó dùng helper procedure check `INFORMATION_SCHEMA` (xem `001_*.sql` làm mẫu):
  ```sql
  DROP PROCEDURE IF EXISTS _migrate_add_col;
  DELIMITER //
  CREATE PROCEDURE _migrate_add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
  BEGIN
    IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = tbl
          AND COLUMN_NAME = col) = 0 THEN
      SET @ddl := CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
      PREPARE _s FROM @ddl; EXECUTE _s; DEALLOCATE PREPARE _s;
    END IF;
  END //
  DELIMITER ;

  CALL _migrate_add_col('table_name', 'col_name', 'INT NOT NULL DEFAULT 0 AFTER other_col');

  DROP PROCEDURE IF EXISTS _migrate_add_col;
  ```
- Tránh `DROP COLUMN` / `RENAME` — nếu bắt buộc, thử kỹ trên staging trước.

## Cách chạy
- **Tự động:** mỗi lần push lên `main`, GitHub Actions chạy `bash migrations/run.sh` trên VPS trước khi build.
- **Thủ công trên VPS:**
  ```bash
  cd /opt/creamee
  bash migrations/run.sh
  ```
- **Local (test):** đặt biến `MYSQL_*` trong `.env` rồi `bash migrations/run.sh`.

## Cơ chế theo dõi
Runner tạo bảng `schema_migrations(filename, applied_at)`. Mỗi file `.sql` chỉ chạy 1 lần đầu tiên, sau đó skip.

## Fresh install
Chạy `database.sql` 1 lần để dựng schema gốc, rồi `bash migrations/run.sh` để apply mọi migration tiếp theo.
