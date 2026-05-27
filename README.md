# CREAMEE ERP v7

Hệ thống quản lý doanh nghiệp cho **CREAMEE** — đơn vị bán sỉ quần áo (hàng
dệt kim), nhập hàng từ Trung Quốc, bán tại Việt Nam. Bản v7 chuyển toàn bộ
nghiệp vụ từ Google Sheets sang ứng dụng web.

## Công nghệ

- **Next.js 15** (App Router, Server Actions, route group)
- **Supabase** — Postgres + Auth + Row Level Security
- **TypeScript** strict, **Tailwind CSS**, **shadcn/ui**
- **recharts** cho biểu đồ

## Tính năng chính

| Nhóm | Module |
|------|--------|
| Bán hàng | Khách hàng, Đơn bán (duyệt theo ngưỡng), Sản phẩm |
| Mua hàng & Kho | Nhà cung cấp, Đơn nhập (CNY), Vận chuyển xuyên biên giới |
| Tài chính | Thu chi, Công nợ, Báo cáo P&L |
| CRM | Cơ hội bán hàng (Kanban) |
| Hệ thống | Trợ lý AI, Người dùng (7 vai trò), Cài đặt |
| Đối ngoại | Cổng khách hàng (`/portal`) |

## Phân quyền — 7 vai trò nội bộ

Chủ, Kế toán trưởng, Kế toán viên, Nhân sự, Quản lý, Sales, Kho — cộng vai
trò ẩn `customer` cho cổng khách hàng. Phân quyền thực thi ở tầng Postgres
bằng RLS; giá vốn tự ẩn với vai trò không được phép qua các view `v_*_safe`.

## Bốn trụ cột tự động hoá

1. **Auto-add entity** — combobox kiểu Notion, gõ tên mới tạo luôn không cần
   mở form (`components/entity-combobox.tsx`, `app/api/entity/[entity]`).
2. **Auto CRUD từ schema** — khai báo `EntitySchema` một lần, form và bảng
   tự sinh (`lib/schema-form.ts`, `components/schema-form.tsx`, `data-table.tsx`).
3. **Auto LLM integration** — abstraction layer chuẩn cho Claude/OpenAI/Gemini
   qua adapter pattern (`lib/llm/`).
4. **Auto logging/retry/rate-limit** — mọi lời gọi LLM đi qua `callLLM()` với
   token bucket, exponential backoff và logging (`lib/llm/client.ts`).

## Mô hình chi phí xuyên biên giới

Một chuyến vận chuyển gộp nhiều đơn nhập (PO). Chi phí chia 3 chặng:

- **C1** — NCC → kho Trung Quốc (phí gần cố định mỗi chuyến)
- **C2** — Trung Quốc → biên giới VN (tính theo **kg**, mỗi đơn vị vận
  chuyển có đơn giá ¥/kg riêng)
- **C3** — biên giới → kho CREAMEE (nhập tay, VND)

Chi phí phân bổ xuống từng dòng hàng **theo tỷ trọng cân nặng**, nên áo
nhẹ tự gánh phí ship thấp hơn. Giá vốn dùng **bình quân gia quyền (WAC)**.
Toàn bộ tính toán nằm ở trigger SQL (`0008_shipment_legs.sql`) và được mirror trên client (`lib/landed-cost.ts`) để xem trước realtime. Mỗi chặng (nội địa TQ, TQ→HN, HN→HCM) là một bản ghi độc lập, cùng một dạng chi phí, gộp được nhiều đơn mua.

## Cấu trúc thư mục

```
app/
  (app)/        — ứng dụng nội bộ (sidebar + topbar)
  (portal)/     — cổng khách hàng (magic link)
  api/          — entity auto-add, AI chat, cron jobs
components/     — UI tái dùng + generator (schema-form, data-table)
lib/            — business logic, roles, LLM layer, landed cost
supabase/migrations/  — 12 file SQL (0001 → 0012)
scripts/        — migrate dữ liệu từ Google Sheets
```

## Bắt đầu

Xem [DEPLOY.md](./DEPLOY.md) để triển khai đầy đủ. Chạy nhanh local:

```bash
npm install
cp .env.example .env.local   # điền biến môi trường
npm run dev
```

## Migration SQL

Chạy lần lượt trong Supabase SQL Editor: `0001` → `0012`. File `0005` nâng vai trò lên 7, `0007`-`0008` xây mô hình vận chuyển theo chặng, `0009` tách giá vốn hàng/ship, `0010`-`0012` theo dõi giá vốn theo lô — FIFO sửa được, xuất kho khi giao hàng, bán âm tính giá vốn 0 và tự bù khi có lô mới.
