import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader } from '@/components/page-header';
import { CustomersClient } from './customers-client';
import type { Customer } from '@/lib/types';
import type { Role } from '@/lib/roles';

export const metadata = { title: 'Khách hàng — CREAMEE ERP' };

export default async function CustomersPage() {
  const profile = await requireAccess('/customers');

  const { rows: customers } = await query<Customer>(
    'SELECT * FROM customers WHERE is_active = 1 ORDER BY created_at DESC LIMIT 500',
  );

  const role = profile.role as Role;
  const canEdit = ['owner', 'manager', 'sales'].includes(role);

  return (
    <div>
      <PageHeader
        title="Khách hàng"
        description={`${customers.length} khách hàng đang hoạt động`}
      />
      <CustomersClient customers={customers} canEdit={canEdit} />
    </div>
  );
}
