import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader } from '@/components/page-header';
import { LeadsClient } from './leads-client';
import { canManageUsers, type Role } from '@/lib/roles';
import type { Lead } from './actions';

export const metadata = { title: 'Leads & Tiềm năng — CREAMEE ERP' };

export default async function LeadsPage() {
  const profile = await requireAccess('/leads');

  const { rows: leads } = await query<Lead>(
    `SELECT id, code, name, phone, email, city, source, need,
            status, assigned_to_email, customer_id, notes,
            created_at, updated_at
     FROM leads
     ORDER BY created_at DESC
     LIMIT 500`,
  );

  const canEdit = (profile.role as Role) !== 'warehouse' && (profile.role as Role) !== 'customer';

  return (
    <div>
      <PageHeader
        title="Leads & Khách hàng tiềm năng"
        description={`${leads.length} leads • ${leads.filter((l) => l.status === 'won').length} đã chốt`}
      />
      <LeadsClient leads={leads} canEdit={canEdit} />
    </div>
  );
}
