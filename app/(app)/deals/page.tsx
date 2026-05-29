import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader } from '@/components/page-header';
import { DealsBoard } from './deals-board';
import { quickCreateCustomer } from '@/app/(app)/customers/actions';
import type { DealStage } from './actions';

export const metadata = { title: 'Cơ hội bán hàng — CREAMEE ERP' };

export default async function DealsPage() {
  await requireAccess('/deals');

  const { rows: dealRows } = await query<{
    id: string; code: string; title: string; customer_id: string | null;
    customer_name_snapshot: string | null; stage: string;
    estimated_value: number | null; probability_pct: number;
    expected_close_date: string | null; next_action: string | null;
    customer_name: string | null;
  }>(
    `SELECT d.id, d.code, d.title, d.customer_id, d.customer_name_snapshot,
            d.stage, d.estimated_value, d.probability_pct,
            d.expected_close_date, d.next_action,
            c.name AS customer_name
     FROM deals d
     LEFT JOIN customers c ON d.customer_id = c.id
     ORDER BY d.created_at DESC
     LIMIT 300`,
  );

  const { rows: customerRows } = await query<{ id: string; name: string }>(
    "SELECT id, name FROM customers WHERE is_active = 1 ORDER BY name",
  );

  const deals = dealRows.map((d) => ({
    ...d,
    stage: d.stage as DealStage,
    customer: d.customer_name ? { name: d.customer_name } : null,
  }));

  const customers = customerRows.map((c) => ({ id: c.id, label: c.name }));

  return (
    <div>
      <PageHeader
        title="Cơ hội bán hàng"
        description="Kéo thả thẻ giữa các cột để cập nhật giai đoạn"
      />
      <DealsBoard
        deals={deals}
        customers={customers}
        onQuickCreateCustomer={quickCreateCustomer}
      />
    </div>
  );
}
