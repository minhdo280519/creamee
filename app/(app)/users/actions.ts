'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { canManageUsers, ROLES, type Role } from '@/lib/roles';
import type { ActionResult } from '@/app/(app)/customers/actions';

/** Tạo user mới — chỉ Chủ + Nhân sự. */
export async function createUser(values: {
  email: string;
  password: string;
  full_name: string;
  role: string;
  phone?: string;
}): Promise<ActionResult<{ id: string }>> {
  const me = await requireUser();
  if (!canManageUsers(me.role as Role)) {
    return { ok: false, error: 'Bạn không có quyền tạo người dùng' };
  }
  if (me.role === 'hr' && values.role === 'owner') {
    return { ok: false, error: 'Nhân sự không thể tạo tài khoản Chủ' };
  }
  if (!ROLES.includes(values.role as Role)) {
    return { ok: false, error: 'Vai trò không hợp lệ' };
  }

  const { rows: dup } = await query<{ id: string }>(
    'SELECT id FROM profiles WHERE email = ? LIMIT 1',
    [values.email],
  );
  if (dup.length > 0) return { ok: false, error: 'Email đã tồn tại trong hệ thống' };

  const passwordHash = await bcrypt.hash(values.password, 12);
  const id = crypto.randomUUID();

  await query(
    `INSERT INTO profiles
     (id, email, full_name, role, phone, password_hash, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, values.email, values.full_name, values.role, values.phone || null, passwordHash],
  );

  revalidatePath('/users');
  return { ok: true, data: { id } };
}

/** Cập nhật user (tên, role, trạng thái). */
export async function updateUser(
  id: string,
  values: { full_name: string; role: string; phone?: string; is_active: boolean },
): Promise<ActionResult> {
  const me = await requireUser();
  if (!canManageUsers(me.role as Role)) {
    return { ok: false, error: 'Bạn không có quyền sửa người dùng' };
  }

  if (me.role === 'hr') {
    if (values.role === 'owner') {
      return { ok: false, error: 'Nhân sự không thể gán vai trò Chủ' };
    }
    const { rows } = await query<{ role: string }>(
      'SELECT role FROM profiles WHERE id = ? LIMIT 1',
      [id],
    );
    if (rows[0]?.role === 'owner') {
      return { ok: false, error: 'Nhân sự không thể sửa tài khoản Chủ' };
    }
  }

  await query(
    `UPDATE profiles
     SET full_name = ?, role = ?, phone = ?, is_active = ?
     WHERE id = ?`,
    [values.full_name, values.role, values.phone || null, values.is_active ? 1 : 0, id],
  );

  revalidatePath('/users');
  return { ok: true };
}
