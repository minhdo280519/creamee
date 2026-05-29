'use server';

import { revalidatePath } from 'next/cache';
import { unlink, readdir, rm } from 'fs/promises';
import path from 'path';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import type { ActionResult } from '@/app/(app)/customers/actions';
import type { ProductVariant } from '@/lib/types';

// ── Lấy danh sách variants theo product ─────────────────────

export async function getVariantsByProduct(productId: string): Promise<ProductVariant[]> {
  await requireUser();
  const { rows } = await query<ProductVariant & { image_urls: string }>(
    `SELECT id, product_id, sku, color, size, barcode,
            cost_cny, cost_vnd, price_vnd, current_stock,
            image_urls, notes, is_active, created_at, updated_at
     FROM product_variants
     WHERE product_id = ? AND is_active = 1
     ORDER BY color, size`,
    [productId],
  );
  return rows.map((r) => ({
    ...r,
    cost_cny: Number(r.cost_cny),
    cost_vnd: Number(r.cost_vnd),
    price_vnd: Number(r.price_vnd),
    current_stock: Number(r.current_stock),
    image_urls: r.image_urls ? JSON.parse(r.image_urls as unknown as string) : null,
  }));
}

// ── Tạo variant mới ──────────────────────────────────────────

export async function createVariant(
  productId: string,
  values: {
    sku: string;
    color?: string;
    size?: string;
    barcode?: string;
    cost_cny?: number;
    cost_vnd?: number;
    price_vnd?: number;
    image_urls?: string[];
    notes?: string;
  },
): Promise<ActionResult<{ id: string }>> {
  await requireUser();

  const sku = values.sku?.trim();
  if (!sku) return { ok: false, error: 'SKU bắt buộc' };

  const { rows: dup } = await query<{ id: string }>(
    'SELECT id FROM product_variants WHERE sku = ? LIMIT 1',
    [sku],
  );
  if (dup.length > 0) return { ok: false, error: `SKU "${sku}" đã tồn tại` };

  const id = crypto.randomUUID();
  await query(
    `INSERT INTO product_variants
     (id, product_id, sku, color, size, barcode, cost_cny, cost_vnd, price_vnd, image_urls, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, productId, sku,
      values.color || null,
      values.size || null,
      values.barcode || null,
      Number(values.cost_cny) || 0,
      Number(values.cost_vnd) || 0,
      Number(values.price_vnd) || 0,
      values.image_urls?.length ? JSON.stringify(values.image_urls) : null,
      values.notes || null,
    ],
  );

  revalidatePath('/products');
  return { ok: true, data: { id } };
}

// ── Cập nhật variant ─────────────────────────────────────────

export async function updateVariant(
  id: string,
  values: {
    sku?: string;
    color?: string;
    size?: string;
    barcode?: string;
    cost_cny?: number;
    cost_vnd?: number;
    price_vnd?: number;
    image_urls?: string[];
    notes?: string;
    is_active?: boolean;
  },
): Promise<ActionResult> {
  await requireUser();

  if (values.sku) {
    const { rows: dup } = await query<{ id: string }>(
      'SELECT id FROM product_variants WHERE sku = ? AND id != ? LIMIT 1',
      [values.sku, id],
    );
    if (dup.length > 0) return { ok: false, error: `SKU "${values.sku}" đã tồn tại` };
  }

  await query(
    `UPDATE product_variants SET
       sku = COALESCE(?, sku),
       color = ?,
       size = ?,
       barcode = ?,
       cost_cny = ?,
       cost_vnd = ?,
       price_vnd = ?,
       image_urls = ?,
       notes = ?,
       is_active = ?
     WHERE id = ?`,
    [
      values.sku || null,
      values.color || null,
      values.size || null,
      values.barcode || null,
      Number(values.cost_cny) || 0,
      Number(values.cost_vnd) || 0,
      Number(values.price_vnd) || 0,
      values.image_urls !== undefined
        ? (values.image_urls.length ? JSON.stringify(values.image_urls) : null)
        : undefined,
      values.notes || null,
      values.is_active !== false ? 1 : 0,
      id,
    ].filter((v) => v !== undefined),
  );

  revalidatePath('/products');
  return { ok: true };
}

// ── Xóa variant (soft delete) ────────────────────────────────

export async function deleteVariant(id: string): Promise<ActionResult> {
  await requireUser();

  await query('UPDATE product_variants SET is_active = 0 WHERE id = ?', [id]);
  revalidatePath('/products');
  return { ok: true };
}

// ── Xóa ảnh khỏi variant ────────────────────────────────────

export async function removeVariantImage(
  variantId: string,
  imageUrl: string,
): Promise<ActionResult> {
  await requireUser();

  const { rows } = await query<{ image_urls: string }>(
    'SELECT image_urls FROM product_variants WHERE id = ? LIMIT 1',
    [variantId],
  );
  if (!rows[0]) return { ok: false, error: 'Variant không tồn tại' };

  const current: string[] = rows[0].image_urls
    ? JSON.parse(rows[0].image_urls)
    : [];
  const next = current.filter((u) => u !== imageUrl);

  await query(
    'UPDATE product_variants SET image_urls = ? WHERE id = ?',
    [next.length ? JSON.stringify(next) : null, variantId],
  );

  // Xóa file vật lý
  try {
    const filePath = path.join(process.cwd(), 'public', imageUrl);
    await unlink(filePath);
  } catch {
    // Không log lỗi nếu file đã bị xóa
  }

  revalidatePath('/products');
  return { ok: true };
}

// ── Xóa toàn bộ ảnh của variant (khi xóa variant) ───────────

export async function purgeVariantImages(variantId: string): Promise<void> {
  try {
    const dir = path.join(process.cwd(), 'public', 'uploads', 'variants', variantId);
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Không lỗi nếu thư mục không tồn tại
  }
}
