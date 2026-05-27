# CREAMEE ERP v7 — Hướng dẫn triển khai

Tài liệu này hướng dẫn đưa hệ thống lên môi trường thật. Toàn bộ quá trình
mất khoảng 30–45 phút nếu làm tuần tự.

## 1. Yêu cầu

- Tài khoản [Supabase](https://supabase.com) (gói free dùng tốt cho < 20 user)
- Tài khoản [Vercel](https://vercel.com) để host Next.js
- Node.js 20+ nếu chạy local
- (Tuỳ chọn) API key của Claude / OpenAI / Gemini cho trợ lý AI

## 2. Tạo dự án Supabase

1. Tạo project mới trên Supabase, ghi lại mật khẩu database.
2. Vào **SQL Editor**, chạy lần lượt các file trong `supabase/migrations/`
   theo đúng thứ tự số: `0001` → `0002` → `0003` → `0004` → `0005` →
   `0006` → `0007` → `0008` → `0009` → `0010` → `0011` → `0012`. Mỗi file chạy một lần.
3. Vào **Settings → API**, ghi lại:
   - `Project URL`
   - `anon public` key
   - `service_role` key (giữ bí mật tuyệt đối)
4. Vào **Settings → Database**, sao chép `Connection string` (chế độ URI).

## 3. Cấu hình biến môi trường

Tạo file `.env.local` (local) hoặc khai báo trên Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app

# Khoá mã hoá API key LLM — sinh bằng: openssl rand -hex 32
ENCRYPTION_KEY=<chuỗi hex 64 ký tự>

# Bảo vệ cron endpoint — sinh bằng: openssl rand -hex 16
CRON_SECRET=<chuỗi ngẫu nhiên>

# Tuỳ chọn — API key LLM (cũng có thể nhập trong trang Cài đặt)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

> **Quan trọng:** `ENCRYPTION_KEY` phải đúng 64 ký tự hex. Nếu mất khoá này,
> các API key LLM đã lưu sẽ không giải mã được — phải nhập lại.

## 4. Tạo tài khoản Chủ đầu tiên

Migration `0006_seed_users.sql` đã tạo sẵn các profile mẫu, nhưng cần tạo
auth user tương ứng. Có 2 cách:

**Cách A — Supabase Dashboard:** Vào **Authentication → Users → Add user**,
tạo user với email Chủ, rồi vào **SQL Editor** chạy:

```sql
update profiles set role = 'owner', is_active = true
where email = 'email-chu@creamee.vn';
```

**Cách B — qua trang Người dùng:** Sau khi đăng nhập bằng tài khoản Chủ
đầu tiên, dùng trang `/users` để tạo các nhân viên còn lại.

## 5. Chạy local (kiểm thử)

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`, đăng nhập bằng tài khoản Chủ.

## 6. Deploy lên Vercel

1. Push code lên GitHub.
2. Trên Vercel: **New Project** → import repo.
3. Khai báo toàn bộ biến môi trường ở mục 3 vào **Environment Variables**.
4. Bấm **Deploy**.
5. Cron job (`vercel.json`) tự kích hoạt: kiểm tra hằng ngày + cập nhật
   tỷ giá. Đảm bảo `CRON_SECRET` đã được khai báo.

## 7. Nhập dữ liệu cũ (tuỳ chọn)

Nếu chuyển từ Google Sheets v6:

1. Xuất các sheet ra CSV, đặt vào `sheets_export/`.
2. Cài: `pip install psycopg2-binary python-dotenv`
3. Đặt `DATABASE_URL` (connection string ở mục 2) vào `.env`.
4. Chạy: `python scripts/migrate_from_sheets.py`

Script chỉ chuyển danh mục (khách hàng, NCC, sản phẩm). Đơn hàng và giao
dịch nên nhập lại thủ công để giữ đúng mã đơn, trạng thái duyệt và tồn kho.

## 8. Cấu hình trợ lý AI

Đăng nhập bằng tài khoản Chủ → **Cài đặt** → nhập API key cho Claude /
OpenAI / Gemini. Key được mã hoá AES-256 trước khi lưu vào database.

## 9. Cổng khách hàng

Khách hàng truy cập `/portal` để tra cứu đơn hàng. Họ đăng nhập bằng
magic link gửi qua email (không cần mật khẩu). Email phải khớp với một
khách hàng đang hoạt động trong hệ thống.

Để magic link hoạt động, cấu hình **Authentication → Email Templates**
và **URL Configuration** trên Supabase, thêm `NEXT_PUBLIC_SITE_URL/portal/orders`
vào danh sách redirect hợp lệ.

## 10. Kiểm tra sau triển khai

- [ ] Đăng nhập được bằng tài khoản Chủ
- [ ] Tạo thử 1 khách hàng, 1 sản phẩm
- [ ] Tạo thử 1 đơn bán — kiểm tra luồng duyệt
- [ ] Trang Cài đặt nhập được API key AI
- [ ] Trợ lý AI trả lời được câu hỏi
- [ ] Cron `/api/cron/fx-update` chạy (kiểm tra bảng `fx_rates`)
- [ ] Khách hàng đăng nhập được vào `/portal`

## Bảo mật — lưu ý

- Lớp bảo vệ dữ liệu thật là **RLS ở Postgres**, không phải middleware.
  Mọi bảng nhạy cảm đều có policy theo 7 vai trò.
- `service_role` key chỉ dùng phía server, không bao giờ lộ ra client.
- Giá vốn (`cost_cny`, `cost_vnd`) tự động ẩn với vai trò không được phép
  thông qua các view `v_*_safe`.
