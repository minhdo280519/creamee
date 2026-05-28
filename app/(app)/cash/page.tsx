import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { canApproveCash, type Role } from '@/lib/roles';
import { PageHeader } from '@/components/page-header';
import { CashClient } from './cash-client';
import type { CashTransaction } from '@/lib/types';

export const metadata = { title: 'Thu chi — CREAMEE ERP' };

export default async function CashPage() {
  const profile = await requireAccess('/cash');

  const [
    { rows: transactions },
    { rows: soRows },
    { rows: poRows },
  ] = await Promise.all([
    query<CashTransaction>(
      'SELECT * FROM cash_transactions ORDER BY transaction_date DESC LIMIT 300',
    ),
    query<{ id: string; code: string; customer_name: string }>(
      `SELECT so.id, so.code, COALESCE(c.name,'—') AS customer_name
       FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id
       WHERE so.status NOT IN ('cancelled','completed')
       ORDER BY so.order_date DESC LIMIT 200`,
    ),
    query<{ id: string; code: string; supplier_name: string }>(
      `SELECT po.id, po.code, COALESCE(s.name,'—') AS supplier_name
       FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.status NOT IN ('cancelled','received')
       ORDER BY po.order_date DESC LIMIT 200`,
    ),
  ]);

  const pending = transactions.filter((t) => t.status === 'pending').length;

  return (
    <div>
      <PageHeader
        title="Thu chi tiền mặt"
        description={
          `${transactions.length} giao dịch` +
          (pending > 0 ? ` • ${pending} chờ duyệt` : '')
        }
      />
      <CashClient
        transactions={transactions}
        canApprove={canApproveCash(profile.role as Role)}
        salesOrders={soRows}
        purchaseOrders={poRows}
      />
    </div>
  );
}
