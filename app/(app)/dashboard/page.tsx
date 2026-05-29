import {
  TrendingUp, TrendingDown, Truck, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { vnd, num, formatDate } from '@/lib/utils';
import { ROLE_LABELS, isFinance, isManagement, type Role } from '@/lib/roles';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardKpi } from './dashboard-kpi';
import type {
  TodayOrder, PendingOrder, LowStockProduct, ArRow,
} from './dashboard-kpi';

export const metadata = { title: 'Bảng điều khiển — CREAMEE ERP' };

export default async function DashboardPage() {
  const profile = await requireUser();
  const role = profile.role as Role;

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const lastMonth = (() => {
    const d = new Date(today);
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();

  const [
    { rows: revenueToday },
    { rows: pending },
    { rows: lowStock },
    { rows: arRows },
    { rows: revenueThisMonth },
    { rows: revenueLastMonth },
    { rows: recentSOs },
    { rows: leadCounts },
    { rows: pendingCash },
    { rows: poArriving },
    // Detail data for drill-down
    { rows: todayOrdersDetail },
    { rows: pendingOrdersDetail },
    { rows: lowStockDetail },
    { rows: arDetail },
  ] = await Promise.all([
    query<{ total: number }>(
      "SELECT COALESCE(SUM(total), 0) AS total FROM sales_orders WHERE DATE(order_date) = ? AND status != 'cancelled'",
      [today],
    ),
    query<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM sales_orders WHERE status = 'pending_approval'",
    ),
    query<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM products WHERE current_stock <= reorder_point AND is_active = 1',
    ),
    query<{ outstanding: number; overdue: number }>(
      `SELECT
         COALESCE(SUM(total - paid_amount), 0) AS outstanding,
         COALESCE(SUM(CASE WHEN DATEDIFF(NOW(), order_date) > 30 THEN 1 ELSE 0 END), 0) AS overdue
       FROM sales_orders
       WHERE payment_status != 'paid' AND status NOT IN ('cancelled','draft')`,
    ),
    query<{ total: number }>(
      `SELECT COALESCE(SUM(total), 0) AS total
       FROM sales_orders
       WHERE DATE_FORMAT(order_date, '%Y-%m') = ? AND status NOT IN ('cancelled','draft')`,
      [thisMonth],
    ),
    query<{ total: number }>(
      `SELECT COALESCE(SUM(total), 0) AS total
       FROM sales_orders
       WHERE DATE_FORMAT(order_date, '%Y-%m') = ? AND status NOT IN ('cancelled','draft')`,
      [lastMonth],
    ),
    query<{ id: string; code: string; customer_name: string | null; total: number; status: string; order_date: string }>(
      `SELECT so.id, so.code,
              COALESCE(c.name, so.customer_name_snapshot, '—') AS customer_name,
              so.total, so.status, so.order_date
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       WHERE so.status NOT IN ('cancelled','draft')
       ORDER BY so.created_at DESC LIMIT 5`,
    ),
    query<{ status: string; cnt: number }>(
      `SELECT status, COUNT(*) AS cnt FROM leads GROUP BY status`,
    ).catch(() => ({ rows: [] })),
    query<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM cash_transactions WHERE status = 'pending'",
    ).catch(() => ({ rows: [{ cnt: 0 }] })),
    query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM purchase_orders
       WHERE status NOT IN ('received','cancelled')
         AND expected_arrival_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`,
    ).catch(() => ({ rows: [{ cnt: 0 }] })),

    // Today's orders detail
    query<TodayOrder>(
      `SELECT so.id, so.code,
              COALESCE(c.name, so.customer_name_snapshot, '—') AS customer_name,
              so.total, so.status, so.order_date
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       WHERE DATE(so.order_date) = ? AND so.status != 'cancelled'
       ORDER BY so.created_at DESC`,
      [today],
    ),
    // Pending approval detail
    query<PendingOrder>(
      `SELECT so.id, so.code,
              COALESCE(c.name, so.customer_name_snapshot, '—') AS customer_name,
              so.total, so.order_date
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       WHERE so.status = 'pending_approval'
       ORDER BY so.created_at ASC`,
    ),
    // Low stock detail
    query<LowStockProduct>(
      `SELECT id, name, sku, current_stock, reorder_point,
              COALESCE(unit, 'cái') AS unit
       FROM products
       WHERE current_stock <= reorder_point AND is_active = 1
       ORDER BY current_stock ASC`,
    ),
    // AR breakdown
    query<ArRow>(
      `SELECT so.code,
              COALESCE(c.name, so.customer_name_snapshot, '—') AS customer_name,
              so.total, so.paid_amount,
              (so.total - so.paid_amount) AS remaining,
              so.order_date, so.payment_status
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       WHERE so.payment_status != 'paid' AND so.status NOT IN ('cancelled','draft')
       ORDER BY remaining DESC`,
    ),
  ]);

  const thisMonthRevenue = revenueThisMonth[0]?.total ?? 0;
  const lastMonthRevenue = revenueLastMonth[0]?.total ?? 0;
  const monthGrowth = lastMonthRevenue > 0
    ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : null;

  const showFinance = isFinance(role) || role === 'manager';
  const showManagement = isManagement(role) || role === 'accountant_lead';

  const leadCountMap: Record<string, number> = {};
  for (const r of leadCounts) leadCountMap[r.status] = r.cnt;
  const totalLeads = Object.values(leadCountMap).reduce((a, b) => a + b, 0);

  const STATUS_COLORS: Record<string, string> = {
    draft: 'secondary', pending_approval: 'warning', approved: 'default',
    processing: 'warning', partial_delivered: 'default', delivered: 'default',
    completed: 'success', cancelled: 'destructive',
  };
  const STATUS_VN: Record<string, string> = {
    draft: 'Nháp', pending_approval: 'Chờ duyệt', approved: 'Đã duyệt',
    processing: 'Đang xử lý', partial_delivered: 'Giao 1 phần',
    delivered: 'Đã giao', completed: 'Hoàn tất', cancelled: 'Huỷ',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Xin chào, ${profile.full_name.split(' ').slice(-1)[0]}`}
        description={`Tổng quan hoạt động — vai trò ${ROLE_LABELS[role]}`}
      />

      {/* Clickable KPI cards with drill-down dialogs */}
      <DashboardKpi
        kpi={{
          orders_today: todayOrdersDetail.length,
          revenue_today: revenueToday[0]?.total ?? 0,
          pending_approvals: pending[0]?.cnt ?? 0,
          low_stock_count: lowStock[0]?.cnt ?? 0,
          total_ar: arRows[0]?.outstanding ?? 0,
          overdue_ar_count: arRows[0]?.overdue ?? 0,
          showFinance,
          showManagement,
        }}
        todayOrders={todayOrdersDetail}
        pendingOrders={pendingOrdersDetail}
        lowStockProducts={lowStockDetail}
        arRows={arDetail}
      />

      {/* Second row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Doanh thu tháng này vs tháng trước */}
        {showFinance && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Doanh thu tháng này
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vnd(thisMonthRevenue)}</div>
              {monthGrowth !== null && (
                <div className={`flex items-center gap-1 mt-1 text-sm ${monthGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {monthGrowth >= 0
                    ? <TrendingUp className="h-4 w-4" />
                    : <TrendingDown className="h-4 w-4" />}
                  {monthGrowth >= 0 ? '+' : ''}{monthGrowth.toFixed(1)}% so tháng trước
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-0.5">
                Tháng trước: {vnd(lastMonthRevenue)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leads pipeline */}
        {totalLeads > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                <span>Leads pipeline</span>
                <Link href="/leads" className="text-primary hover:underline text-xs">Xem tất cả</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {[
                { key: 'new', label: 'Mới tiếp nhận' },
                { key: 'consulting', label: 'Đang tư vấn' },
                { key: 'quoted', label: 'Đã báo giá' },
                { key: 'won', label: 'Đã chốt' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{leadCountMap[key] ?? 0}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Cần xử lý */}
        {showManagement && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cần xử lý
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(pendingCash[0]?.cnt ?? 0) > 0 && (
                <Link href="/cash" className="flex items-center justify-between text-sm hover:text-primary">
                  <span>Phiếu thu/chi chờ duyệt</span>
                  <Badge variant="warning">{pendingCash[0]?.cnt}</Badge>
                </Link>
              )}
              {(poArriving[0]?.cnt ?? 0) > 0 && (
                <Link href="/purchase-orders" className="flex items-center justify-between text-sm hover:text-primary">
                  <div className="flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" />
                    <span>PO về trong 7 ngày</span>
                  </div>
                  <Badge variant="default">{poArriving[0]?.cnt}</Badge>
                </Link>
              )}
              {(pending[0]?.cnt ?? 0) > 0 && (
                <Link href="/sales-orders" className="flex items-center justify-between text-sm hover:text-primary">
                  <span>Đơn bán chờ duyệt</span>
                  <Badge variant="warning">{pending[0]?.cnt}</Badge>
                </Link>
              )}
              {(pendingCash[0]?.cnt ?? 0) === 0 &&
               (poArriving[0]?.cnt ?? 0) === 0 &&
               (pending[0]?.cnt ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">Không có gì cần xử lý.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent SOs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Đơn bán hàng gần nhất</span>
            <Link href="/sales-orders" className="text-primary hover:underline text-xs font-normal">
              Xem tất cả
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentSOs.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">Chưa có đơn nào.</p>
          ) : (
            <div className="divide-y">
              {recentSOs.map((so) => (
                <div key={so.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{so.code}</p>
                      <p className="text-xs text-muted-foreground">{so.customer_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{vnd(so.total)}</span>
                    <Badge variant={(STATUS_COLORS[so.status] ?? 'secondary') as 'default' | 'secondary' | 'warning' | 'success' | 'destructive'}>
                      {STATUS_VN[so.status] ?? so.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {formatDate(so.order_date)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
