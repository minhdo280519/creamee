'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { createSession, setSessionCookie, clearSessionCookie } from '@/lib/session';

export interface AuthResult {
  error?: string;
}

/** Đăng nhập bằng email + mật khẩu. */
export async function signIn(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Vui lòng nhập đầy đủ email và mật khẩu.' };
  }

  const { rows } = await query<{
    id: string;
    email: string;
    role: string;
    password_hash: string;
    is_active: number;
  }>(
    'SELECT id, email, role, password_hash, is_active FROM profiles WHERE email = ? LIMIT 1',
    [email],
  );

  const user = rows[0];
  if (!user || !user.password_hash) {
    return { error: 'Email hoặc mật khẩu không đúng.' };
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return { error: 'Email hoặc mật khẩu không đúng.' };
  }

  if (!user.is_active) {
    return { error: 'Tài khoản đã bị vô hiệu hoá. Liên hệ quản trị viên.' };
  }

  await query('UPDATE profiles SET last_login_at = NOW() WHERE id = ?', [user.id]);

  const token = await createSession({ userId: user.id, email: user.email, role: user.role });
  await setSessionCookie(token);

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

/** Đăng xuất. */
export async function signOut(): Promise<void> {
  await clearSessionCookie();
  revalidatePath('/', 'layout');
  redirect('/login');
}
