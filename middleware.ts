import { jwtVerify } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';
import { canAccessRoute, type Role } from '@/lib/roles';

// jose dùng được trong Edge Runtime — không cần Node.js natives.
const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'creamee-erp-secret-key-change-in-prod-32c',
);
const COOKIE = 'erp_session';

/**
 * Middleware: chạy trước mọi request.
 *  1. Kiểm tra JWT trong cookie.
 *  2. Chưa đăng nhập → đẩy về /login.
 *  3. Đã đăng nhập + role không có quyền vào route → đẩy về /dashboard.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = path === '/login' || path.startsWith('/portal');

  const token = request.cookies.get(COOKIE)?.value;
  let session: { userId: string; role: string } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      session = {
        userId: payload.userId as string,
        role: payload.role as string,
      };
    } catch {
      // Token hết hạn hoặc không hợp lệ.
    }
  }

  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (session && path === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  if (session && !isPublic && path !== '/dashboard' && path !== '/') {
    const role = (session.role ?? 'sales') as Role;
    if (!canAccessRoute(role, path)) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
