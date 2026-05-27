'use client';

import * as React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line,
} from 'recharts';
import { vnd } from '@/lib/utils';
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
  /** Role có được xem giá vốn/lợi nhuận không. */
  canViewCost: boolean;
}

/** Format tháng YYYY-MM-DD → "MM/YY". */
function fmtMonth(m: string): string {
  const d = new Date(m);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}

export function AnalyticsClient({ monthly, canViewCost }: Props) {
  const chartData = monthly.map((m) => ({
    month: fmtMonth(m.month),
    'Doanh thu': m.revenue,
    'Giá vốn hàng': m.goods_cogs ?? 0,
    'Chi phí ship': m.ship_cogs ?? 0,
    'Lãi gộp trước ship': m.gross_profit_before_ship ?? 0,
    'Lãi gộp sau ship': m.gross_profit ?? 0,
    'Lãi ròng': m.net_profit ?? 0,
  }));

  // Tổng kỳ.
  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const totalGoodsCogs = monthly.reduce((s, m) => s + (m.goods_cogs ?? 0), 0);
  const totalShipCogs = monthly.reduce((s, m) => s + (m.ship_cogs ?? 0), 0);
  const totalGrossBefore = monthly.reduce(
    (s, m) => s + (m.gross_profit_before_ship ?? 0),
    0,
  );
  const totalGross = monthly.reduce((s, m) => s + (m.gross_profit ?? 0), 0);
  const totalNet = monthly.reduce((s, m) => s + (m.net_profit ?? 0), 0);
  const avgMargin =
    totalRevenue > 0 ? (totalGross / totalRevenue) * 100 : 0;
  // Ship ăn mòn bao nhiêu % lợi nhuận.
  const shipDragPct =
    totalGrossBefore > 0
      ? (totalShipCogs / totalGrossBefore) * 100
      : 0;

  return (
    <div className="space-y-4">
      {/* KPI tổng */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Doanh thu (12 tháng)</p>
            <p className="text-lg font-semibold">{vnd(totalRevenue)}</p>
          </CardContent>
        </Card>
        {canViewCost && (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  Lãi gộp trước ship
                </p>
                <p className="text-lg font-semibold text-emerald-700">
                  {vnd(totalGrossBefore)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Chi phí ship</p>
                <p className="text-lg font-semibold text-amber-600">
                  − {vnd(totalShipCogs)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Ăn mòn {shipDragPct.toFixed(1)}% lãi gộp
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  Lãi gộp sau ship
                </p>
                <p className="text-lg font-semibold text-emerald-700">
                  {vnd(totalGross)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Lãi ròng</p>
                <p
                  className={`text-lg font-semibold ${
                    totalNet >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {vnd(totalNet)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Biên {avgMargin.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Biểu đồ doanh thu vs giá vốn — giá vốn hàng & ship tách riêng */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Doanh thu, Giá vốn hàng &amp; Chi phí ship theo tháng
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis
                className="text-xs"
                tickFormatter={(v) => `${(v / 1e6).toFixed(0)}tr`}
              />
              <Tooltip
                formatter={(v: number) => vnd(v)}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Doanh thu" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              {canViewCost && (
                <>
                  {/* Giá vốn hàng và ship xếp chồng — thấy rõ tỷ trọng ship. */}
                  <Bar
                    dataKey="Giá vốn hàng"
                    stackId="cost"
                    fill="#f59e0b"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="Chi phí ship"
                    stackId="cost"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Biểu đồ lợi nhuận — chỉ role xem được giá vốn */}
      {canViewCost && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lợi nhuận theo tháng</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis
                  className="text-xs"
                  tickFormatter={(v) => `${(v / 1e6).toFixed(0)}tr`}
                />
                <Tooltip
                  formatter={(v: number) => vnd(v)}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="Lãi gộp trước ship"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
                <Line
                  type="monotone"
                  dataKey="Lãi gộp sau ship"
                  stroke="#0d9488"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="Lãi ròng"
                  stroke="#6366f1"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {!canViewCost && (
        <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Thông tin giá vốn và lợi nhuận chỉ hiển thị với vai trò được phân quyền.
        </p>
      )}
    </div>
  );
}
