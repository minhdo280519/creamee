import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader } from '@/components/page-header';
import { UsersClient } from './users-client';
import type { Role } from '@/lib/roles';

export const metadata = { title: 'Người dùng — CREAMEE ERP' };

export default async function UsersPage() {
  const profile = await requireAccess('/users');

  const { rows: users } = await query<{
    id: string; email: string; full_name: string;
    role: string; phone: string | null; is_active: number; created_at: string;
  }>(
    'SELECT id, email, full_name, role, phone, is_active, created_at FROM profiles ORDER BY created_at DESC',
  );

  return (
    <div>
      <PageHeader
        title="Quản lý người dùng"
        description={`${users.length} tài khoản trong hệ thống`}
      />
      <UsersClient
        users={users.map((u) => ({ ...u, role: u.role as Role, is_active: Boolean(u.is_active) }))}
        myRole={profile.role as Role}
      />
    </div>
  );
}
