# Migrations

Mỗi thay đổi DB sau khi đã deploy → tạo 1 file mới ở đây.

## Quy tắc đặt tên
`NNN_mo_ta_ngan.sql` — ví dụ: `002_them_bang_promotion.sql`. Số tăng dần, không trùng.

## Quy tắc viết SQL (idempotent — chạy nhiều lần không lỗi)
- `CREATE TABLE IF NOT EXISTS ...`
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
- `CREATE INDEX IF NOT EXISTS ...` (MySQL 8.0.29+)
- `INSERT ... ON DUPLICATE KEY UPDATE ...` (thay cho INSERT thường)
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
