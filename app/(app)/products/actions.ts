'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import type { ActionResult } from '@/app/(app)/customers/actions';

/** Tạo sản phẩm mới. */
export async function createProduct(
  values: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  await requireUser();

  const sku = String(values.sku ?? '').trim();
  const name = String(values.name ?? '').trim();
  if (!sku || !name) return { ok: false, error: 'SKU và tên sản phẩm bắt buộc' };

  const { rows: dup } = await query<{ id: string }>(
    'SELECT id FROM products WHERE sku = ? LIMIT 1',
    [sku],
  );
  if (dup.length > 0) return { ok: false, error: `SKU "${sku}" đã tồn tại` };

  const id = crypto.randomUUID();
  const { affectedRows } = await query(
    `INSERT INTO products
     (id, sku, name, category, supplier_id, base_price_vnd,
      wholesale_price_vnd, weight_grams, reorder_point, reorder_qty,
      image_url, description, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, sku, name,
      values.category || null,
      values.supplier_id || null,
      Number(values.base_price_vnd) || 0,
      Number(values.wholesale_price_vnd) || null,
      Number(values.weight_grams) || null,
      Number(values.reorder_point) || 0,
      Number(values.reorder_qty) || 0,
      values.image_url || null,
      values.description || null,
      values.is_active !== false ? 1 : 0,
    ],
  );

  if (affectedRows === 0) return { ok: false, error: 'Không tạo được sản phẩm' };

  revalidatePath('/products');
  return { ok: true, data: { id } };
}

/** Cập nhật sản phẩm. */
export async function updateProduct(
  id: string,
  values: Record<string, unknown>,
): Promise<ActionResult> {
  await requireUser();

  await query(
    `UPDATE products SET
       sku = ?, name = ?, category = ?, supplier_id = ?,
       base_price_vnd = ?, wholesale_price_vnd = ?, weight_grams = ?,
       reorder_point = ?, reorder_qty = ?, image_url = ?, description = ?, is_active = ?
     WHERE id = ?`,
    [
      values.sku,
      values.name,
      values.category || null,
      values.supplier_id || null,
      Number(values.base_price_vnd) || 0,
      Number(values.wholesale_price_vnd) || null,
      Number(values.weight_grams) || null,
      Number(values.reorder_point) || 0,
      Number(values.reorder_qty) || 0,
      values.image_url || null,
      values.description || null,
      values.is_active !== false ? 1 : 0,
      id,
    ],
  );

  revalidatePath('/products');
  return { ok: true };
}

/**
 * Tạo nhanh sản phẩm chỉ với tên — cho EntityCombobox auto-add.
 */
export async function quickCreateProduct(name: string): Promise<{ id: string; label: string }> {
  await requireUser();

  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tên sản phẩm trống');

  const { rows: cnt } = await query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM products');
  const sku = 'SP' + String((cnt[0]?.cnt ?? 0) + 1).padStart(4, '0');
  const id = crypto.randomUUID();

  await query(
    `INSERT INTO products (id, sku, name, base_price_vnd, reorder_point, reorder_qty, is_active)
     VALUES (?, ?, ?, 0, 0, 0, 1)`,
    [id, sku, trimmed],
  );

  revalidatePath('/products');
  return { id, label: trimmed };
}

export interface ProductMovement {
  date: string;
  type: 'in' | 'out';
  qty: number;
  lot_code: string | null;
  ref_code: string | null;
  ref_type: 'PO' | 'SO';
  note: string;
}

/** Lịch sử nhập/xuất của một sản phẩm — từ inventory_lots và delivery_lot_lines. */
export async function getProductHistory(productId: string): Promise<{
  ok: boolean;
  productName?: string;
  movements?: ProductMovement[];
  error?: string;
}> {
  await requireUser();

  const { rows: pRows } = await query<{ name: string }>(
    'SELECT name FROM products WHERE id = ? LIMIT 1',
    [productId],
  );
  if (!pRows[0]) return { ok: false, error: 'Không tìm thấy sản phẩm' };

  // Nhập kho: inventory_lots
  const { rows: inRows } = await query<{
    lot_code: string; qty_total: number; created_at: string;
    po_code: string | null;
  }>(
    `SELECT il.lot_code, il.qty_total, il.created_at,
            po.code AS po_code
     FROM inventory_lots il
     LEFT JOIN purchase_order_items poi ON il.po_item_id = poi.id
     LEFT JOIN purchase_orders po ON poi.po_id = po.id
     WHERE il.product_id = ?
     ORDER BY il.created_at ASC`,
    [productId],
  );

  // Xuất kho: delivery_lot_lines
  const { rows: outRows } = await query<{
    created_at: string; qty: number; lot_id: string;
    so_code: string | null; lot_code: string | null;
  }>(
    `SELECT dll.created_at, dll.qty, dll.lot_id,
            so.code AS so_code, il.lot_code
     FROM delivery_lot_lines dll
     LEFT JOIN sales_orders so  ON dll.order_id = so.id
     LEFT JOIN inventory_lots il ON dll.lot_id = il.id
     WHERE dll.product_id = ?
     ORDER BY dll.created_at ASC`,
    [productId],
  );

  // Xuất qua markDelivered (sales_order_items.delivered_qty, no lot line)
  const { rows: soDelivered } = await query<{
    delivered_qty: number; product_name_snapshot: string;
    so_code: string; updated_at: string;
  }>(
    `SELECT soi.delivered_qty, soi.product_name_snapshot,
            so.code AS so_code, so.updated_at
     FROM sales_order_items soi
     JOIN sales_orders so ON soi.order_id = so.id
     WHERE soi.product_id = ? AND soi.delivered_qty > 0
     ORDER BY so.updated_at ASC`,
    [productId],
  );

  const movements: ProductMovement[] = [
    ...inRows.map((r) => ({
      date: r.created_at,
      type: 'in' as const,
      qty: Number(r.qty_total),
      lot_code: r.lot_code,
      ref_code: r.po_code,
      ref_type: 'PO' as const,
      note: r.po_code ? `Nhập từ ${r.po_code}` : 'Nhập kho',
    })),
    ...outRows.map((r) => ({
      date: r.created_at,
      type: 'out' as const,
      qty: Number(r.qty),
      lot_code: r.lot_code,
      ref_code: r.so_code,
      ref_type: 'SO' as const,
      note: r.so_code ? `Xuất cho ${r.so_code}` : 'Xuất kho',
    })),
  ];

  // Nếu không có delivery_lot_lines, dùng sales_order_items.delivered_qty
  if (outRows.length === 0 && soDelivered.length > 0) {
    for (const r of soDelivered) {
      movements.push({
        date: r.updated_at,
        type: 'out',
        qty: Number(r.delivered_qty),
        lot_code: null,
        ref_code: r.so_code,
        ref_type: 'SO',
        note: `Xuất cho ${r.so_code}`,
      });
    }
  }

  movements.sort((a, b) => a.date.localeCompare(b.date));

  return { ok: true, productName: pRows[0].name, movements };
}

/**
 * Tạo nhanh nhà cung cấp chỉ với tên — cho EntityCombobox auto-add.
 */
export async function quickCreateSupplier(
  name: string,
): Promise<{ id: string; label: string }> {
  await requireUser();

  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tên nhà cung cấp trống');

  const { rows: cnt } = await query<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM suppliers',
  );
  const code = 'NCC' + String((cnt[0]?.cnt ?? 0) + 1).padStart(3, '0');
  const id = crypto.randomUUID();

  await query(
    `INSERT INTO suppliers (id, code, name, country, currency, is_active)
     VALUES (?, ?, ?, 'CN', 'CNY', 1)`,
    [id, code, trimmed],
  );

  revalidatePath('/products');
  revalidatePath('/suppliers');
  return { id, label: trimmed };
}
