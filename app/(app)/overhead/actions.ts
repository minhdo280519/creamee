'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import type { ActionResult } from '@/app/(app)/customers/actions';
import type { OverheadCost, OrderCostAllocation, Fund, FundTransaction, FundType } from '@/lib/types';

const OVERHEAD_CATEGORIES = [
  'Lương nhân viên', 'Thuê kho/văn phòng', 'Điện nước', 'Internet/Điện thoại',
  'Marketing/Quảng cáo', 'Vận chuyển nội địa', 'Phần mềm/Tools', 'Khác',
];
export { OVERHEAD_CATEGORIES };

// ── Overhead CRUD ────────────────────────────────────────────

export async function getOverheadByMonth(year: number, month: number): Promise<OverheadCost[]> {
  await requireUser();
  const { rows } = await query<OverheadCost>(
    'SELECT * FROM overhead_costs WHERE year = ? AND month = ? ORDER BY category',
    [year, month],
  );
  return rows.map((r) => ({ ...r, amount_vnd: Number(r.amount_vnd) }));
}

export async function upsertOverheadCost(
  data: { year: number; month: number; category: string; amount_vnd: number; notes?: string },
): Promise<ActionResult<{ id: string }>> {
  const profile = await requireUser();
  const { rows: existing } = await query<{ id: string }>(
    'SELECT id FROM overhead_costs WHERE year = ? AND month = ? AND category = ? LIMIT 1',
    [data.year, data.month, data.category],
  );

  if (existing[0]) {
    await query(
      'UPDATE overhead_costs SET amount_vnd = ?, notes = ?, created_by = ? WHERE id = ?',
      [data.amount_vnd, data.notes ?? null, profile.id, existing[0].id],
    );
    revalidatePath('/overhead');
    return { ok: true, data: { id: existing[0].id } };
  }

  const id = crypto.randomUUID();
  await query(
    'INSERT INTO overhead_costs (id, year, month, category, amount_vnd, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, data.year, data.month, data.category, data.amount_vnd, data.notes ?? null, profile.id],
  );
  revalidatePath('/overhead');
  return { ok: true, data: { id } };
}

// ── Phân bổ overhead vào SO ──────────────────────────────────

export async function allocateOverheadToOrder(
  salesOrderId: string,
): Promise<ActionResult> {
  await requireUser();

  // Lấy thông tin SO
  const { rows: soRows } = await query<{
    total: number; order_date: string; status: string;
  }>(
    'SELECT total, order_date, status FROM sales_orders WHERE id = ? LIMIT 1',
    [salesOrderId],
  );
  if (!soRows[0]) return { ok: false, error: 'Không tìm thấy SO' };

  const so = soRows[0];
  const orderDate = new Date(so.order_date);
  const year = orderDate.getFullYear();
  const month = orderDate.getMonth() + 1;

  // Tổng overhead tháng đó
  const { rows: ohRows } = await query<{ total: number }>(
    'SELECT COALESCE(SUM(amount_vnd), 0) AS total FROM overhead_costs WHERE year = ? AND month = ?',
    [year, month],
  );
  const totalOverheadMonth = Number(ohRows[0]?.total ?? 0);

  // Tổng doanh thu tháng đó (để tính tỷ lệ phân bổ)
  const { rows: revenueRows } = await query<{ total_revenue: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total_revenue FROM sales_orders
     WHERE YEAR(order_date) = ? AND MONTH(order_date) = ?
       AND status NOT IN ('cancelled','draft')`,
    [year, month],
  );
  const totalRevMonth = Number(revenueRows[0]?.total_revenue ?? 1);

  // Tỷ lệ overhead cho đơn này
  const revenue = Number(so.total);
  const overheadAlloc = totalRevMonth > 0
    ? Math.round(totalOverheadMonth * (revenue / totalRevMonth))
    : 0;

  // COGS: lấy từ SO items (WAC cost_vnd x qty)
  const { rows: cogsRows } = await query<{ cogs: number }>(
    `SELECT COALESCE(SUM(p.cost_vnd * soi.quantity), 0) AS cogs
     FROM sales_order_items soi
     LEFT JOIN products p ON soi.product_id = p.id
     WHERE soi.order_id = ?`,
    [salesOrderId],
  );
  const directCogs = Number(cogsRows[0]?.cogs ?? 0);

  // Ship cost: từ shipment_items
  const { rows: shipRows } = await query<{ ship: number }>(
    `SELECT COALESCE(SUM(si.alloc_cost_vnd), 0) AS ship
     FROM shipment_items si
     JOIN shipments s ON si.shipment_id = s.id
     WHERE s.so_id = ?`,
    [salesOrderId],
  );
  const shipCost = Number(shipRows[0]?.ship ?? 0);

  const grossProfit = revenue - directCogs - shipCost;
  const netProfit = grossProfit - overheadAlloc;

  await query(
    `INSERT INTO order_cost_allocations
     (id, sales_order_id, direct_cogs_vnd, ship_cost_vnd, overhead_allocated_vnd,
      revenue_vnd, gross_profit_vnd, net_profit_vnd, overhead_year, overhead_month)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       direct_cogs_vnd         = VALUES(direct_cogs_vnd),
       ship_cost_vnd           = VALUES(ship_cost_vnd),
       overhead_allocated_vnd  = VALUES(overhead_allocated_vnd),
       revenue_vnd             = VALUES(revenue_vnd),
       gross_profit_vnd        = VALUES(gross_profit_vnd),
       net_profit_vnd          = VALUES(net_profit_vnd),
       overhead_year           = VALUES(overhead_year),
       overhead_month          = VALUES(overhead_month),
       updated_at              = NOW()`,
    [salesOrderId, directCogs, shipCost, overheadAlloc, revenue, grossProfit, netProfit, year, month],
  );

  revalidatePath('/analytics');
  revalidatePath('/overhead');
  return { ok: true };
}

// ── Fund management ──────────────────────────────────────────

export async function getFunds(): Promise<Fund[]> {
  await requireUser();
  const { rows } = await query<Fund>('SELECT * FROM funds ORDER BY fund_type');
  return rows.map((r) => ({ ...r, balance_vnd: Number(r.balance_vnd) }));
}

export async function getFundTransactions(fundType?: FundType): Promise<FundTransaction[]> {
  await requireUser();
  const where = fundType ? 'WHERE fund_type = ?' : '';
  const { rows } = await query<FundTransaction>(
    `SELECT * FROM fund_transactions ${where} ORDER BY created_at DESC LIMIT 200`,
    fundType ? [fundType] : [],
  );
  return rows.map((r) => ({ ...r, amount_vnd: Number(r.amount_vnd) }));
}

export async function fundDeposit(data: {
  fund_type: FundType;
  amount_vnd: number;
  reason?: string;
}): Promise<ActionResult> {
  const profile = await requireUser();
  if (data.amount_vnd <= 0) return { ok: false, error: 'Số tiền phải > 0' };

  await query(
    'UPDATE funds SET balance_vnd = balance_vnd + ? WHERE fund_type = ?',
    [data.amount_vnd, data.fund_type],
  );
  await query(
    `INSERT INTO fund_transactions (id, fund_type, transaction_type, amount_vnd, reason, created_by)
     VALUES (UUID(), ?, 'deposit', ?, ?, ?)`,
    [data.fund_type, data.amount_vnd, data.reason ?? null, profile.id],
  );
  revalidatePath('/overhead');
  return { ok: true };
}

export async function fundWithdrawal(data: {
  fund_type: FundType;
  amount_vnd: number;
  reason?: string;
}): Promise<ActionResult> {
  const profile = await requireUser();
  if (data.amount_vnd <= 0) return { ok: false, error: 'Số tiền phải > 0' };

  const { rows } = await query<{ balance_vnd: number }>(
    'SELECT balance_vnd FROM funds WHERE fund_type = ? LIMIT 1',
    [data.fund_type],
  );
  if (Number(rows[0]?.balance_vnd ?? 0) < data.amount_vnd) {
    return { ok: false, error: 'Số dư quỹ không đủ' };
  }

  await query(
    'UPDATE funds SET balance_vnd = balance_vnd - ? WHERE fund_type = ?',
    [data.amount_vnd, data.fund_type],
  );
  await query(
    `INSERT INTO fund_transactions (id, fund_type, transaction_type, amount_vnd, reason, created_by)
     VALUES (UUID(), ?, 'withdrawal', ?, ?, ?)`,
    [data.fund_type, data.amount_vnd, data.reason ?? null, profile.id],
  );
  revalidatePath('/overhead');
  return { ok: true };
}
