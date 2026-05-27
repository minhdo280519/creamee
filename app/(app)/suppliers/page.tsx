import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader } from '@/components/page-header';
import { SuppliersClient } from './suppliers-client';
import type { Supplier } from '@/lib/types';
import type { Role } from '@/lib/roles';

export const metadata = { title: 'Nhà cung cấp — CREAMEE ERP' };

export default async function SuppliersPage() {
  const profile = await requireAccess('/suppliers');

  const { rows: suppliers } = await query<Supplier>(
    'SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name LIMIT 500',
  );

  const canEdit = ['owner', 'manager', 'warehouse'].includes(profile.role as Role);

  return (
    <div>
      <PageHeader
        title="Nhà cung cấp"
        description={`${suppliers.length} nhà cung cấp đang hợp tác`}
      />
      <SuppliersClient suppliers={suppliers} canEdit={canEdit} />
    </div>
  );
}
