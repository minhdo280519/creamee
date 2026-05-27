'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import type { ActionResult } from '@/app/(app)/customers/actions';

/** Tạo nhà cung cấp. */
export async function createSupplier(
  values: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  await requireUser();

  const name = String(values.name ?? '').trim();
  if (!name) return { ok: false, error: 'Tên nhà cung cấp bắt buộc' };

  const { rows: cnt } = await query<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM suppliers',
  );
  const code = 'NCC' + String((cnt[0]?.cnt ?? 0) + 1).padStart(3, '0');
  const id = crypto.randomUUID();

  const { affectedRows } = await query(
    `INSERT INTO suppliers
     (id, code, name, contact_person, phone, wechat_id, email, address,
      country, currency, notes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, code, name,
      values.contact_person || null,
      values.phone || null,
      values.wechat_id || null,
      values.email || null,
      values.address || null,
      values.country || 'CN',
      values.currency || 'CNY',
      values.notes || null,
      values.is_active !== false ? 1 : 0,
    ],
  );

  if (affectedRows === 0) return { ok: false, error: 'Không tạo được nhà cung cấp' };

  revalidatePath('/suppliers');
  return { ok: true, data: { id } };
}

/** Cập nhật nhà cung cấp. */
export async function updateSupplier(
  id: string,
  values: Record<string, unknown>,
): Promise<ActionResult> {
  await requireUser();

  await query(
    `UPDATE suppliers SET
       name = ?, contact_person = ?, phone = ?, wechat_id = ?,
       email = ?, address = ?, country = ?, currency = ?,
       notes = ?, is_active = ?
     WHERE id = ?`,
    [
      values.name,
      values.contact_person || null,
      values.phone || null,
      values.wechat_id || null,
      values.email || null,
      values.address || null,
      values.country || 'CN',
      values.currency || 'CNY',
      values.notes || null,
      values.is_active !== false ? 1 : 0,
      id,
    ],
  );

  revalidatePath('/suppliers');
  return { ok: true };
}
