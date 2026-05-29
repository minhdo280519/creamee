import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader } from '@/components/page-header';
import { OverheadClient } from './overhead-client';
import { getFunds, getFundTransactions } from './actions';
import { getCashFlowForecast } from './forecast-actions';
import { buildDailyBalances } from '@/lib/cash-forecast';
import type { OrderCostAllocation } from '@/lib/types';

export const metadata = { title: 'Chi phí & Quỹ — CREAMEE ERP' };

export default async function OverheadPage() {
  await requireAccess('/overhead');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [
    { rows: overheadRows },
    { rows: allocRows },
    funds,
    fundTx,
    { events: forecastEvents, currentBalance },
  ] = await Promise.all([
    query<{ category: string; amount_vnd: number }>(
      'SELECT category, amount_vnd FROM overhead_costs WHERE year = ? AND month = ? ORDER BY category',
      [year, month],
    ),
    query<OrderCostAllocation & { so_code: string; customer_name: string }>(
      `SELECT oca.*, so.code AS so_code, COALESCE(c.name, '—') AS customer_name
       FROM order_cost_allocations oca
       JOIN sales_orders so ON oca.sales_order_id = so.id
       LEFT JOIN customers c ON so.customer_id = c.id
       WHERE oca.overhead_year = ? AND oca.overhead_month = ?
       ORDER BY oca.net_profit_vnd DESC
       LIMIT 100`,
      [year, month],
    ),
    getFunds(),
    getFundTransactions(),
    getCashFlowForecast(),
  ]);

  const forecastBalances = buildDailyBalances(forecastEvents, currentBalance);

  const overheadByCategory = overheadRows.map((r) => ({
    category: r.category,
    amount_vnd: Number(r.amount_vnd),
  }));

  const allocations = allocRows.map((r) => ({
    ...r,
    direct_cogs_vnd: Number(r.direct_cogs_vnd),
    ship_cost_vnd: Number(r.ship_cost_vnd),
    overhead_allocated_vnd: Number(r.overhead_allocated_vnd),
    revenue_vnd: Number(r.revenue_vnd),
    gross_profit_vnd: Number(r.gross_profit_vnd),
    net_profit_vnd: Number(r.net_profit_vnd),
  }));

  return (
    <div>
      <PageHeader
        title="Chi phí & Quỹ"
        description={`Tháng ${month}/${year} — Overhead, phân bổ chi phí, quản lý quỹ`}
      />
      <OverheadClient
        year={year}
        month={month}
        overheadByCategory={overheadByCategory}
        allocations={allocations as unknown as (OrderCostAllocation & { so_code: string; customer_name: string })[]}
        funds={funds}
        fundTransactions={fundTx}
        forecastBalances={forecastBalances}
        forecastEvents={forecastEvents}
      />
    </div>
  );
}
