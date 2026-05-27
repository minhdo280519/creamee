'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { genCustomerCode } from '@/lib/business-logic';

export interface ActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

/** Tạo khách hàng mới. Tự sinh mã KH. */
export async function createCustomer(
  values: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  await requireUser();

  const name = String(values.name ?? '').trim();
  if (!name) return { ok: false, error: 'Tên khách hàng bắt buộc' };

  // Chống trùng tên (case-insensitive).
  const { rows: dup } = await query<{ id: string }>(
    'SELECT id FROM customers WHERE LOWER(name) = LOWER(?) LIMIT 1',
    [name],
  );
  if (dup.length > 0) return { ok: false, error: 'Đã tồn tại khách hàng cùng tên' };

  const { rows: cnt } = await query<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM customers',
  );
  const code = genCustomerCode(name, cnt[0]?.cnt ?? 0);

  const id = crypto.randomUUID();
  const { affectedRows } = await query(
    `INSERT INTO customers
     (id, code, name, phone, email, address, city, tax_code, tier,
      credit_limit, payment_terms_days, notes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, code, name,
      values.phone || null,
      values.email || null,
      values.address || null,
      values.city || null,
      values.tax_code || null,
      values.tier || 'standard',
      Number(values.credit_limit) || 0,
      Number(values.payment_terms_days) || 0,
      values.notes || null,
      values.is_active !== false ? 1 : 0,
    ],
  );

  if (affectedRows === 0) return { ok: false, error: 'Không tạo được khách hàng' };

  revalidatePath('/customers');
  return { ok: true, data: { id } };
}

/** Cập nhật khách hàng. */
export async function updateCustomer(
  id: string,
  values: Record<string, unknown>,
): Promise<ActionResult> {
  await requireUser();

  const { affectedRows } = await query(
    `UPDATE customers SET
       name = ?, phone = ?, email = ?, address = ?, city = ?,
       tax_code = ?, tier = ?, credit_limit = ?,
       payment_terms_days = ?, notes = ?, is_active = ?
     WHERE id = ?`,
    [
      values.name,
      values.phone || null,
      values.email || null,
      values.address || null,
      values.city || null,
      values.tax_code || null,
      values.tier || 'standard',
      Number(values.credit_limit) || 0,
      Number(values.payment_terms_days) || 0,
      values.notes || null,
      values.is_active !== false ? 1 : 0,
      id,
    ],
  );

  if (affectedRows === 0) return { ok: false, error: 'Không tìm thấy khách hàng' };

  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

/** Xoá mềm khách hàng (set is_active = 0). */
export async function deactivateCustomer(id: string): Promise<ActionResult> {
  await requireUser();

  await query('UPDATE customers SET is_active = 0 WHERE id = ?', [id]);

  revalidatePath('/customers');
  return { ok: true };
}

/**
 * Tạo nhanh khách hàng chỉ với tên — dùng cho EntityCombobox auto-add.
 */
export async function quickCreateCustomer(
  name: string,
): Promise<{ id: string; label: string }> {
  const result = await createCustomer({ name, tier: 'standard', is_active: true });
  if (!result.ok || !result.data) {
    throw new Error(result.error ?? 'Không tạo được khách hàng');
  }
  return { id: result.data.id, label: name };
}
