import {
  ShoppingCart, Banknote, ClipboardCheck, PackageX, Scale, AlertTriangle,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { vnd, num } from '@/lib/utils';
import { ROLE_LABELS, isFinance, isManagement, type Role } from '@/lib/roles';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardMetrics } from '@/lib/types';

export const metadata = { title: 'Bảng điều khiển — CREAMEE ERP' };

export default async function DashboardPage() {
  const profile = await requireUser();
  const role = profile.role as Role;

  const today = new Date().toISOString().slice(0, 10);

  const [
    { rows: ordersToday },
    { rows: revenueToday },
    { rows: pending },
    { rows: lowStock },
    { rows: arRows },
  ] = await Promise.all([
    query<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM sales_orders WHERE DATE(order_date) = ? AND status != 'cancelled'",
      [today],
    ),
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
  ]);

  const metrics: DashboardMetrics = {
    orders_today: ordersToday[0]?.cnt ?? 0,
    revenue_today: revenueToday[0]?.total ?? 0,
    pending_approvals: pending[0]?.cnt ?? 0,
    low_stock_count: lowStock[0]?.cnt ?? 0,
    overdue_ar_count: arRows[0]?.overdue ?? 0,
    total_ar: arRows[0]?.outstanding ?? 0,
    total_ap_cny: 0,
  };

  const showFinance = isFinance(role) || role === 'manager';

  return (
    <div>
      <PageHeader
        title={`Xin chào, ${profile.full_name.split(' ').slice(-1)[0]}`}
        description={`Tổng quan hoạt động hôm nay — vai trò ${ROLE_LABELS[role]}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Đơn hôm nay" value={num(metrics.orders_today)} icon={ShoppingCart} />
        {showFinance && (
          <StatCard
            label="Doanh thu hôm nay"
            value={vnd(metrics.revenue_today)}
            icon={Banknote}
            tone="success"
          />
        )}
        {(isManagement(role) || role === 'accountant_lead') && (
          <StatCard
            label="Chờ duyệt"
            value={num(metrics.pending_approvals)}
            icon={ClipboardCheck}
            tone={metrics.pending_approvals > 0 ? 'warning' : 'default'}
            hint={metrics.pending_approvals > 0 ? 'Cần xử lý' : 'Không có'}
          />
        )}
        <StatCard
          label="Sản phẩm sắp hết"
          value={num(metrics.low_stock_count)}
          icon={PackageX}
          tone={metrics.low_stock_count > 0 ? 'warning' : 'default'}
        />
        {showFinance && (
          <>
            <StatCard
              label="Tổng công nợ phải thu"
              value={vnd(metrics.total_ar)}
              icon={Scale}
              tone={metrics.total_ar > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Công nợ quá hạn"
              value={num(metrics.overdue_ar_count)}
              icon={AlertTriangle}
              tone={metrics.overdue_ar_count > 0 ? 'danger' : 'default'}
              hint="Đơn quá 30 ngày"
            />
          </>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Bắt đầu nhanh</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Dùng thanh menu bên trái để truy cập các phân hệ. Menu được lọc tự động
          theo vai trò của bạn — bạn chỉ thấy những phần mình có quyền sử dụng.
        </CardContent>
      </Card>
    </div>
  );
}
