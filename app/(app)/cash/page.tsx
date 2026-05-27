import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { canApproveCash, type Role } from '@/lib/roles';
import { PageHeader } from '@/components/page-header';
import { CashClient } from './cash-client';
import type { CashTransaction } from '@/lib/types';

export const metadata = { title: 'Thu chi — CREAMEE ERP' };

export default async function CashPage() {
  const profile = await requireAccess('/cash');

  const { rows: transactions } = await query<CashTransaction>(
    'SELECT * FROM cash_transactions ORDER BY transaction_date DESC LIMIT 300',
  );

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
      />
    </div>
  );
}
