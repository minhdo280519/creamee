'use server';

import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import type { CashFlowEvent } from '@/lib/cash-forecast';

/**
 * Lấy dự báo dòng tiền 30 ngày tới từ SO (chưa thu) và PO (chưa thanh toán).
 */
export async function getCashFlowForecast(): Promise<{
  events: CashFlowEvent[];
  currentBalance: number;
}> {
  await requireUser();

  const today = new Date().toISOString().slice(0, 10);
  const future30 = new Date();
  future30.setDate(future30.getDate() + 30);
  const futureDate = future30.toISOString().slice(0, 10);

  // Dòng tiền VÀO: SO chưa thu đủ, có delivery_date trong 30 ngày
  const { rows: soRows } = await query<{
    so_id: string; so_code: string; customer_name: string;
    remaining: number; delivery_date: string | null;
  }>(
    `SELECT so.id AS so_id, so.code AS so_code,
            COALESCE(c.name, '—') AS customer_name,
            (so.total - so.paid_amount) AS remaining,
            so.delivery_date
     FROM sales_orders so
     LEFT JOIN customers c ON so.customer_id = c.id
     WHERE so.status NOT IN ('cancelled','completed','draft')
       AND (so.total - so.paid_amount) > 0
       AND (so.delivery_date IS NULL OR so.delivery_date <= ?)
     ORDER BY so.delivery_date IS NULL, so.delivery_date ASC
     LIMIT 200`,
    [futureDate],
  );

  // Dòng tiền RA: PO chưa thanh toán đủ, expected_arrival trong 30 ngày
  const { rows: poRows } = await query<{
    po_id: string; po_code: string; supplier_name: string;
    remaining_cny: number; fx_rate: number;
    expected_arrival_date: string | null;
  }>(
    `SELECT po.id AS po_id, po.code AS po_code,
            COALESCE(s.name, '—') AS supplier_name,
            (po.total_cny - po.paid_cny) AS remaining_cny,
            po.fx_rate,
            po.expected_arrival_date
     FROM purchase_orders po
     LEFT JOIN suppliers s ON po.supplier_id = s.id
     WHERE po.status NOT IN ('cancelled','completed','draft')
       AND (po.total_cny - po.paid_cny) > 0
       AND (po.expected_arrival_date IS NULL OR po.expected_arrival_date <= ?)
     ORDER BY po.expected_arrival_date IS NULL, po.expected_arrival_date ASC
     LIMIT 200`,
    [futureDate],
  );

  // Overhead tháng này (daily rate)
  const now = new Date();
  const { rows: ohRows } = await query<{ total: number }>(
    `SELECT COALESCE(SUM(amount_vnd), 0) AS total FROM overhead_costs
     WHERE year = ? AND month = ?`,
    [now.getFullYear(), now.getMonth() + 1],
  );
  const monthlyOverhead = Number(ohRows[0]?.total ?? 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyOverhead = Math.round(monthlyOverhead / daysInMonth);

  // Số dư tiền mặt hiện tại từ cash_transactions
  const { rows: balRows } = await query<{ balance: number }>(
    `SELECT COALESCE(
       SUM(CASE WHEN transaction_type = 'income' THEN amount_vnd ELSE -amount_vnd END), 0
     ) AS balance
     FROM cash_transactions
     WHERE status = 'approved'`,
  );
  const currentBalance = Number(balRows[0]?.balance ?? 0);

  const events: CashFlowEvent[] = [];

  // SO inflows
  for (const r of soRows) {
    const date = r.delivery_date ?? today;
    events.push({
      date,
      type: 'inflow',
      amount_vnd: Math.round(Number(r.remaining)),
      source: `${r.so_code} — ${r.customer_name}`,
      ref_type: 'SO',
      ref_id: r.so_id,
    });
  }

  // PO outflows
  for (const r of poRows) {
    const date = r.expected_arrival_date ?? today;
    const amountVnd = Math.round(Number(r.remaining_cny) * Number(r.fx_rate));
    events.push({
      date,
      type: 'outflow',
      amount_vnd: amountVnd,
      source: `${r.po_code} — ${r.supplier_name}`,
      ref_type: 'PO',
      ref_id: r.po_id,
    });
  }

  // Daily overhead outflows
  if (dailyOverhead > 0) {
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      events.push({
        date: d.toISOString().slice(0, 10),
        type: 'outflow',
        amount_vnd: dailyOverhead,
        source: 'Chi phí vận hành hàng ngày',
        ref_type: 'overhead',
        ref_id: '',
      });
    }
  }

  return { events, currentBalance };
}
