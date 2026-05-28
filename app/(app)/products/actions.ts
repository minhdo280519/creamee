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
