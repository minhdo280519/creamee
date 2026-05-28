'use client';

import * as React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line,
} from 'recharts';
import { vnd, num } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MonthRow {
  month: string;
  revenue: number;
  goods_cogs: number | null;
  ship_cogs: number | null;
  cogs: number | null;
  operating_expenses: number | null;
  gross_profit_before_ship: number | null;
  gross_profit: number | null;
  net_profit: number | null;
}

interface Props {
  monthly: MonthRow[];
  topCustomers: { customer_name: string; total: number; order_count: number }[];
  topProducts: { product_name: string; qty: number; revenue: number }[];
  canViewCost: boolean;
}

function fmtMonth(m: string): string {
  const [year, month] = m.split('-');
  return `${month}/${year?.slice(2)}`;
}

export function AnalyticsClient({ monthly, topCustomers, topProducts, canViewCost }: Props) {
  const chartData = monthly.map((m) => ({
    month: fmtMonth(m.month),
    'Doanh thu': m.revenue,
    'Giá vốn hàng': m.goods_cogs ?? 0,
    'Chi phí ship': m.ship_cogs ?? 0,
    'Lãi gộp trước ship': m.gross_profit_before_ship ?? 0,
    'Lãi gộp sau ship': m.gross_profit ?? 0,
    'Lãi ròng': m.net_profit ?? 0,
  }));

  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const totalGoodsCogs = monthly.reduce((s, m) => s + (m.goods_cogs ?? 0), 0);
  const totalShipCogs = monthly.reduce((s, m) => s + (m.ship_cogs ?? 0), 0);
  const totalCogs = monthly.reduce((s, m) => s + (m.cogs ?? 0), 0);
  const totalGrossBefore = monthly.reduce((s, m) => s + (m.gross_profit_before_ship ?? 0), 0);
  const totalGross = monthly.reduce((s, m) => s + (m.gross_profit ?? 0), 0);
  const totalNet = monthly.reduce((s, m) => s + (m.net_profit ?? 0), 0);
  const avgMargin = totalRevenue > 0 ? (totalGross / totalRevenue) * 100 : 0;
  const shipDragPct = totalGrossBefore > 0 ? (totalShipCogs / totalGrossBefore) * 100 : 0;

  const hasCostData = totalCogs > 0;

  return (
    <div className="space-y-4">
      {/* KPI tổng */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Doanh thu (12 tháng)</p>
            <p className="text-2xl font-bold">{vnd(totalRevenue)}</p>
          </CardContent>
        </Card>
        {canViewCost && hasCostData && (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Tổng giá vốn</p>
                <p className="text-2xl font-bold text-amber-600">{vnd(totalCogs)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Hàng {vnd(totalGoodsCogs)} + Ship {vnd(totalShipCogs)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Lãi gộp sau ship</p>
                <p className={`text-2xl font-bold ${totalGross >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {vnd(totalGross)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Biên lãi gộp {avgMargin.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Ship ăn mòn lợi nhuận</p>
                <p className="text-2xl font-bold text-red-600">{shipDragPct.toFixed(1)}%</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  / lãi gộp trước ship
                </p>
              </CardContent>
            </Card>
          </>
        )}
        {canViewCost && !hasCostData && (
          <Card className="col-span-3">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                Chưa có dữ liệu giá vốn — cần nhập <strong>cost_vnd</strong> cho sản phẩm để xem lợi nhuận.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Biểu đồ doanh thu + giá vốn */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Doanh thu{canViewCost && hasCostData ? ', Giá vốn hàng & Chi phí ship' : ''} theo tháng
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1e6).toFixed(0)}tr`} />
              <Tooltip formatter={(v: number) => vnd(v)} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Doanh thu" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              {canViewCost && hasCostData && (
                <>
                  <Bar dataKey="Giá vốn hàng" stackId="cost" fill="#f59e0b" />
                  <Bar dataKey="Chi phí ship" stackId="cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lợi nhuận chart */}
      {canViewCost && hasCostData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lợi nhuận theo tháng</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1e6).toFixed(0)}tr`} />
                <Tooltip formatter={(v: number) => vnd(v)} contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Lãi gộp trước ship" stroke="#10b981" strokeWidth={2} strokeDasharray="4 3" />
                <Line type="monotone" dataKey="Lãi gộp sau ship" stroke="#0d9488" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top khách hàng + top sản phẩm */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top khách */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 khách hàng (12 tháng)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topCustomers.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">Chưa có dữ liệu.</p>
            ) : (
              <div className="divide-y">
                {topCustomers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{c.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{c.order_count} đơn</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold">{vnd(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top sản phẩm */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 sản phẩm bán chạy (12 tháng)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topProducts.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">Chưa có dữ liệu.</p>
            ) : (
              <div className="divide-y">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{p.product_name}</p>
                        <p className="text-xs text-muted-foreground">{num(p.qty)} cái đã bán</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold">{vnd(p.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!canViewCost && (
        <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Thông tin giá vốn và lợi nhuận chỉ hiển thị với vai trò được phân quyền.
        </p>
      )}
    </div>
  );
}
