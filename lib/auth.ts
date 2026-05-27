import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';
import type { Profile } from '@/lib/types';
import type { Role } from '@/lib/roles';
import { canAccessRoute } from '@/lib/roles';

/**
 * Lấy profile của user đang đăng nhập trong Server Component.
 * Chưa đăng nhập → redirect về /login.
 */
export async function requireUser(): Promise<Profile> {
  const session = await getSession();
  if (!session) redirect('/login');

  const { rows } = await query<Profile>(
    'SELECT * FROM profiles WHERE id = ? AND is_active = 1 LIMIT 1',
    [session.userId],
  );
  const profile = rows[0];
  if (!profile) redirect('/login');
  return profile;
}

/**
 * Lấy user + chặn nếu role không có quyền vào route.
 */
export async function requireAccess(pathname: string): Promise<Profile> {
  const profile = await requireUser();
  if (!canAccessRoute(profile.role as Role, pathname)) {
    redirect('/dashboard');
  }
  return profile;
}

/** Lấy user nếu có, không redirect (cho trang công khai). */
export async function getOptionalUser(): Promise<Profile | null> {
  const session = await getSession();
  if (!session) return null;
  const { rows } = await query<Profile>(
    'SELECT * FROM profiles WHERE id = ? AND is_active = 1 LIMIT 1',
    [session.userId],
  );
  return rows[0] ?? null;
}
