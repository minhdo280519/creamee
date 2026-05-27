import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewCost, type Role } from '@/lib/roles';
import { PageHeader } from '@/components/page-header';
import { AnalyticsClient } from './analytics-client';
import type { MonthlyPnL } from '@/lib/types';

export const metadata = { title: 'Báo cáo — CREAMEE ERP' };

export default async function AnalyticsPage() {
  const profile = await requireAccess('/analytics');

  const { rows: monthly } = await query<MonthlyPnL>(
    `SELECT
       DATE_FORMAT(order_date, '%Y-%m') AS month,
       SUM(total) AS revenue,
       NULL AS goods_cogs,
       NULL AS ship_cogs,
       NULL AS cogs,
       NULL AS operating_expenses,
       NULL AS gross_profit_before_ship,
       NULL AS gross_profit,
       NULL AS net_profit
     FROM sales_orders
     WHERE status NOT IN ('cancelled','draft')
       AND order_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY month
     ORDER BY month`,
  );

  const showCost = canViewCost(profile.role as Role);

  return (
    <div>
      <PageHeader
        title="Báo cáo & Phân tích"
        description="Tình hình kinh doanh 12 tháng gần nhất"
      />
      <AnalyticsClient
        monthly={monthly.map((m) => ({
          month: m.month,
          revenue: m.revenue,
          goods_cogs: m.goods_cogs,
          ship_cogs: m.ship_cogs,
          cogs: m.cogs,
          operating_expenses: m.operating_expenses,
          gross_profit_before_ship: m.gross_profit_before_ship,
          gross_profit: m.gross_profit,
          net_profit: m.net_profit,
        }))}
        canViewCost={showCost}
      />
    </div>
  );
}
