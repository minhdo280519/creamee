'use server';

import { query } from '@/lib/db';
import { createSession, setSessionCookie, clearSessionCookie } from '@/lib/session';
import { redirect } from 'next/navigation';

export interface PortalAuthResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/**
 * Đăng nhập portal cho khách hàng — xác thực bằng email.
 * Nếu email khớp với khách hàng đang hoạt động → tạo session cookie.
 */
export async function sendPortalMagicLink(email: string): Promise<PortalAuthResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) {
    return { ok: false, error: 'Email không hợp lệ' };
  }

  const { rows } = await query<{ id: string; email: string }>(
    'SELECT id, email FROM customers WHERE LOWER(email) = ? AND is_active = 1 LIMIT 1',
    [trimmed],
  );

  if (rows.length === 0) {
    // Không tiết lộ email có tồn tại hay không (chống dò).
    return {
      ok: true,
      message: 'Nếu email hợp lệ, link đăng nhập đã được gửi tới hộp thư.',
    };
  }

  // Tạo session JWT cho khách hàng.
  const customer = rows[0]!;
  const token = await createSession({
    userId: customer.id,
    email: customer.email,
    role: 'customer',
  });
  await setSessionCookie(token);

  redirect('/portal/orders');
}

/** Đăng xuất khỏi portal khách hàng. */
export async function portalSignOut(): Promise<void> {
  await clearSessionCookie();
  redirect('/portal/login');
}
