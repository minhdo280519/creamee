import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewCost, type Role } from '@/lib/roles';
import { PageHeader } from '@/components/page-header';
import { AnalyticsClient } from './analytics-client';
import type { MonthlyPnL } from '@/lib/types';

export const metadata = { title: 'Báo cáo — CREAMEE ERP' };

export default async function AnalyticsPage() {
  const profile = await requireAccess('/analytics');
  const showCost = canViewCost(profile.role as Role);

  const [{ rows: monthly }, { rows: topCustomers }, { rows: topProducts }] = await Promise.all([
    // P&L tháng: doanh thu + COGS từ sản phẩm
    query<MonthlyPnL>(
      `SELECT
         DATE_FORMAT(so.order_date, '%Y-%m') AS month,
         SUM(so.total) AS revenue,
         COALESCE(SUM(soi.quantity * p.goods_cost_vnd), 0) AS goods_cogs,
         COALESCE(SUM(soi.quantity * p.ship_cost_vnd), 0)  AS ship_cogs,
         COALESCE(SUM(soi.quantity * p.cost_vnd), 0)       AS cogs,
         NULL AS operating_expenses,
         COALESCE(SUM(so.total) - SUM(soi.quantity * COALESCE(p.goods_cost_vnd, 0)), 0)
           AS gross_profit_before_ship,
         COALESCE(SUM(so.total) - SUM(soi.quantity * COALESCE(p.cost_vnd, 0)), 0)
           AS gross_profit,
         NULL AS net_profit
       FROM sales_orders so
       LEFT JOIN sales_order_items soi ON soi.order_id = so.id
       LEFT JOIN products p ON soi.product_id = p.id
       WHERE so.status NOT IN ('cancelled', 'draft')
         AND so.order_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month
       ORDER BY month`,
    ),

    // Top 5 khách hàng theo doanh thu 12 tháng
    query<{ customer_name: string; total: number; order_count: number }>(
      `SELECT
         COALESCE(c.name, so.customer_name_snapshot, '—') AS customer_name,
         SUM(so.total) AS total,
         COUNT(*) AS order_count
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       WHERE so.status NOT IN ('cancelled','draft')
         AND so.order_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY so.customer_id, customer_name
       ORDER BY total DESC
       LIMIT 5`,
    ),

    // Top 5 sản phẩm bán chạy 12 tháng
    query<{ product_name: string; qty: number; revenue: number }>(
      `SELECT
         COALESCE(p.name, soi.product_name_snapshot, '—') AS product_name,
         SUM(soi.quantity) AS qty,
         SUM(soi.quantity * soi.unit_price) AS revenue
       FROM sales_order_items soi
       JOIN sales_orders so ON soi.order_id = so.id
       LEFT JOIN products p ON soi.product_id = p.id
       WHERE so.status NOT IN ('cancelled','draft')
         AND so.order_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY soi.product_id, product_name
       ORDER BY qty DESC
       LIMIT 5`,
    ),
  ]);

  return (
    <div>
      <PageHeader
        title="Báo cáo & Phân tích"
        description="Tình hình kinh doanh 12 tháng gần nhất"
      />
      <AnalyticsClient
        monthly={monthly}
        topCustomers={topCustomers}
        topProducts={topProducts}
        canViewCost={showCost}
      />
    </div>
  );
}
