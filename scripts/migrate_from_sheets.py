#!/usr/bin/env python3
"""
migrate_from_sheets.py — Chuyển dữ liệu CREAMEE ERP v6 (Google Sheets)
sang Supabase Postgres của v7.

CÁCH DÙNG
---------
1. Xuất từng sheet ra CSV, đặt vào thư mục ./sheets_export/:
     customers.csv, suppliers.csv, products.csv, sales_orders.csv ...
2. Cài thư viện:  pip install psycopg2-binary python-dotenv
3. Đặt DATABASE_URL trong .env (Supabase → Settings → Database → Connection string)
4. Chạy:  python scripts/migrate_from_sheets.py

Script idempotent: chạy lại nhiều lần không tạo bản ghi trùng (dựa trên
mã code / sku). Cột không khớp sẽ được bỏ qua an toàn.
"""

import csv
import os
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    sys.exit("Thiếu psycopg2. Chạy: pip install psycopg2-binary python-dotenv")

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

EXPORT_DIR = Path(__file__).parent.parent / "sheets_export"
DATABASE_URL = os.environ.get("DATABASE_URL")


def log(msg: str) -> None:
    print(f"[migrate] {msg}")


def read_csv(name: str) -> list[dict]:
    """Đọc 1 file CSV, trả về list dict. Trả [] nếu file không tồn tại."""
    path = EXPORT_DIR / name
    if not path.exists():
        log(f"Bỏ qua {name} (không tìm thấy)")
        return []
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def clean(value):
    """Chuẩn hoá giá trị: chuỗi rỗng → None, strip khoảng trắng."""
    if value is None:
        return None
    v = str(value).strip()
    return v if v else None


def to_number(value, default=0):
    """Ép về số, loại bỏ dấu phẩy ngăn cách nghìn."""
    v = clean(value)
    if v is None:
        return default
    v = v.replace(",", "").replace("₫", "").replace("¥", "").strip()
    try:
        return float(v)
    except ValueError:
        return default


# ── Định nghĩa từng bảng cần migrate ─────────────────────────────────
# Mỗi entry: tên file CSV, bảng đích, cột khoá chống trùng, hàm map row.

def map_customer(row: dict) -> dict:
    return {
        "code": clean(row.get("code") or row.get("Mã KH")),
        "name": clean(row.get("name") or row.get("Tên khách hàng")),
        "phone": clean(row.get("phone") or row.get("SĐT")),
        "email": clean(row.get("email") or row.get("Email")),
        "city": clean(row.get("city") or row.get("Tỉnh/Thành")),
        "address": clean(row.get("address") or row.get("Địa chỉ")),
        "tier": clean(row.get("tier")) or "standard",
        "credit_limit": to_number(row.get("credit_limit") or row.get("Hạn mức")),
        "is_active": True,
    }


def map_supplier(row: dict) -> dict:
    return {
        "code": clean(row.get("code") or row.get("Mã NCC")),
        "name": clean(row.get("name") or row.get("Tên NCC")),
        "contact_person": clean(row.get("contact_person")),
        "phone": clean(row.get("phone")),
        "wechat_id": clean(row.get("wechat_id") or row.get("WeChat")),
        "country": clean(row.get("country")) or "CN",
        "currency": clean(row.get("currency")) or "CNY",
        "is_active": True,
    }


def map_product(row: dict) -> dict:
    return {
        "sku": clean(row.get("sku") or row.get("SKU") or row.get("Mã SP")),
        "name": clean(row.get("name") or row.get("Tên sản phẩm")),
        "category": clean(row.get("category") or row.get("Danh mục")),
        "base_price_vnd": to_number(row.get("base_price_vnd") or row.get("Giá bán")),
        "wholesale_price_vnd": to_number(row.get("wholesale_price_vnd")) or None,
        "weight_grams": to_number(row.get("weight_grams")) or None,
        "current_stock": int(to_number(row.get("current_stock") or row.get("Tồn"))),
        "reorder_point": int(to_number(row.get("reorder_point"))),
        "is_active": True,
    }


TABLES = [
    ("customers.csv", "customers", "code", map_customer),
    ("suppliers.csv", "suppliers", "code", map_supplier),
    ("products.csv", "products", "sku", map_product),
]


def migrate_table(conn, csv_name, table, conflict_col, mapper):
    """Upsert toàn bộ rows của 1 bảng."""
    rows = read_csv(csv_name)
    if not rows:
        return

    mapped = [mapper(r) for r in rows]
    # Bỏ row thiếu khoá chính.
    mapped = [m for m in mapped if m.get(conflict_col)]
    if not mapped:
        log(f"{table}: không có dòng hợp lệ")
        return

    columns = list(mapped[0].keys())
    values = [[m[c] for c in columns] for m in mapped]

    update_cols = [c for c in columns if c != conflict_col]
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)

    sql = (
        f"INSERT INTO {table} ({', '.join(columns)}) VALUES %s "
        f"ON CONFLICT ({conflict_col}) DO UPDATE SET {set_clause}"
    )

    with conn.cursor() as cur:
        execute_values(cur, sql, values)
    conn.commit()
    log(f"{table}: đã nạp {len(values)} dòng")


def main():
    if not DATABASE_URL:
        sys.exit("Thiếu DATABASE_URL. Đặt trong file .env")

    if not EXPORT_DIR.exists():
        sys.exit(f"Không tìm thấy thư mục {EXPORT_DIR}. Hãy xuất CSV vào đó.")

    log(f"Kết nối database...")
    conn = psycopg2.connect(DATABASE_URL)
    try:
        for csv_name, table, conflict_col, mapper in TABLES:
            migrate_table(conn, csv_name, table, conflict_col, mapper)
        log("Hoàn tất migrate.")
        log("Lưu ý: đơn hàng/giao dịch nên nhập lại thủ công để đảm bảo")
        log("tính toàn vẹn (mã đơn, trạng thái duyệt, tồn kho).")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
