'use client';

import * as React from 'react';
import {
  ShoppingCart, Banknote, ClipboardCheck, PackageX, Scale, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { vnd, num, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TodayOrder {
  id: string;
  code: string;
  customer_name: string;
  total: number;
  status: string;
  order_date: string;
}

export interface PendingOrder {
  id: string;
  code: string;
  customer_name: string;
  total: number;
  order_date: string;
}

export interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  reorder_point: number;
  unit: string;
}

export interface ArRow {
  code: string;
  customer_name: string;
  total: number;
  paid_amount: number;
  remaining: number;
  order_date: string;
  payment_status: string;
}

export interface KpiData {
  orders_today: number;
  revenue_today: number;
  pending_approvals: number;
  low_stock_count: number;
  total_ar: number;
  overdue_ar_count: number;
  showFinance: boolean;
  showManagement: boolean;
}

interface Props {
  kpi: KpiData;
  todayOrders: TodayOrder[];
  pendingOrders: PendingOrder[];
  lowStockProducts: LowStockProduct[];
  arRows: ArRow[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
const PAY_VN: Record<string, string> = {
  unpaid: 'Chưa thu', partial: 'Thu 1 phần', paid: 'Đã thu đủ', overpaid: 'Thu dư',
};
const PAY_COLOR: Record<string, string> = {
  unpaid: 'destructive', partial: 'warning', paid: 'success', overpaid: 'default',
};

type ModalType = 'orders_today' | 'revenue_today' | 'pending' | 'low_stock' | 'ar' | null;

// ── Clickable StatCard ────────────────────────────────────────────────────────

const TONE: Record<string, string> = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
};

function ClickableCard({
  label, value, icon: Icon, hint, tone = 'default', onClick,
}: {
  label: string; value: string; icon: React.ElementType;
  hint?: string; tone?: string; onClick: () => void;
}) {
  return (
    <Card
      className="cursor-pointer hover:border-primary/60 hover:shadow-sm transition-all group"
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('rounded-lg p-3 transition-colors', TONE[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-xl font-semibold group-hover:text-primary transition-colors">
            {value}
          </p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className="text-[10px] text-muted-foreground/50 group-hover:text-primary/50 transition-colors shrink-0">
          chi tiết ›
        </span>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardKpi({ kpi, todayOrders, pendingOrders, lowStockProducts, arRows }: Props) {
  const [modal, setModal] = React.useState<ModalType>(null);

  const arOverdue = arRows.filter((r) => {
    const daysOld = Math.floor((Date.now() - new Date(r.order_date).getTime()) / 86400000);
    return daysOld > 30;
  });

  // ── KPI card grid ─────────────────────────────────────────────────────────
  return (
    <>
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ClickableCard
          label="Đơn hôm nay"
          value={num(kpi.orders_today)}
          icon={ShoppingCart}
          onClick={() => setModal('orders_today')}
        />
        {kpi.showFinance && (
          <ClickableCard
            label="Doanh thu hôm nay"
            value={vnd(kpi.revenue_today)}
            icon={Banknote}
            tone="success"
            onClick={() => setModal('revenue_today')}
          />
        )}
        {kpi.showManagement && (
          <ClickableCard
            label="Chờ duyệt"
            value={num(kpi.pending_approvals)}
            icon={ClipboardCheck}
            tone={kpi.pending_approvals > 0 ? 'warning' : 'default'}
            hint={kpi.pending_approvals > 0 ? 'Cần xử lý' : 'Không có'}
            onClick={() => setModal('pending')}
          />
        )}
        <ClickableCard
          label="Sản phẩm sắp hết"
          value={num(kpi.low_stock_count)}
          icon={PackageX}
          tone={kpi.low_stock_count > 0 ? 'warning' : 'default'}
          onClick={() => setModal('low_stock')}
        />
        {kpi.showFinance && (
          <ClickableCard
            label="Tổng công nợ phải thu"
            value={vnd(kpi.total_ar)}
            icon={Scale}
            tone={kpi.total_ar > 0 ? 'warning' : 'default'}
            onClick={() => setModal('ar')}
          />
        )}
        {kpi.showFinance && (
          <ClickableCard
            label="Công nợ quá hạn"
            value={num(kpi.overdue_ar_count)}
            icon={AlertTriangle}
            tone={kpi.overdue_ar_count > 0 ? 'danger' : 'default'}
            hint="Đơn quá 30 ngày"
            onClick={() => setModal('ar')}
          />
        )}
      </div>

      {/* ── Dialogs ── */}

      {/* Today's orders */}
      <Dialog open={modal === 'orders_today' || modal === 'revenue_today'} onOpenChange={(o) => { if (!o) setModal(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {modal === 'revenue_today' ? 'Doanh thu hôm nay' : 'Đơn hàng hôm nay'}
            </DialogTitle>
          </DialogHeader>
          {todayOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có đơn nào hôm nay.</p>
          ) : (
            <>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="h-8 text-xs">Mã đơn</TableHead>
                      <TableHead className="h-8 text-xs">Khách hàng</TableHead>
                      <TableHead className="h-8 text-xs text-right">Giá trị</TableHead>
                      <TableHead className="h-8 text-xs">Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayOrders.map((o) => (
                      <TableRow key={o.id} className="text-sm">
                        <TableCell>
                          <Link href="/sales-orders" className="font-mono text-xs font-medium text-primary hover:underline">
                            {o.code}
                          </Link>
                        </TableCell>
                        <TableCell>{o.customer_name}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{vnd(o.total)}</TableCell>
                        <TableCell>
                          <Badge variant={(STATUS_COLORS[o.status] ?? 'secondary') as 'default' | 'secondary' | 'warning' | 'success' | 'destructive'}>
                            {STATUS_VN[o.status] ?? o.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between text-sm pt-1 px-1">
                <span className="text-muted-foreground">{todayOrders.length} đơn</span>
                <span>
                  Tổng: <strong className="text-foreground">{vnd(todayOrders.reduce((s, o) => s + o.total, 0))}</strong>
                </span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Pending approval */}
      <Dialog open={modal === 'pending'} onOpenChange={(o) => { if (!o) setModal(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Đơn chờ duyệt ({pendingOrders.length})</DialogTitle>
          </DialogHeader>
          {pendingOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Không có đơn nào chờ duyệt.</p>
          ) : (
            <>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="h-8 text-xs">Mã đơn</TableHead>
                      <TableHead className="h-8 text-xs">Khách hàng</TableHead>
                      <TableHead className="h-8 text-xs text-right">Giá trị</TableHead>
                      <TableHead className="h-8 text-xs">Ngày đặt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingOrders.map((o) => (
                      <TableRow key={o.id} className="text-sm">
                        <TableCell>
                          <Link href="/sales-orders" className="font-mono text-xs font-medium text-primary hover:underline">
                            {o.code}
                          </Link>
                        </TableCell>
                        <TableCell>{o.customer_name}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{vnd(o.total)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(o.order_date)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-right text-sm pt-1 px-1">
                Tổng: <strong>{vnd(pendingOrders.reduce((s, o) => s + o.total, 0))}</strong>
              </div>
              <div className="text-right">
                <Link href="/sales-orders" className="text-xs text-primary hover:underline">
                  Vào trang đơn bán để duyệt →
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Low stock */}
      <Dialog open={modal === 'low_stock'} onOpenChange={(o) => { if (!o) setModal(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sản phẩm sắp hết hàng ({lowStockProducts.length})</DialogTitle>
          </DialogHeader>
          {lowStockProducts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Tất cả sản phẩm còn đủ hàng.</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="h-8 text-xs">Sản phẩm</TableHead>
                    <TableHead className="h-8 text-xs">SKU</TableHead>
                    <TableHead className="h-8 text-xs text-right">Tồn kho</TableHead>
                    <TableHead className="h-8 text-xs text-right">Ngưỡng đặt</TableHead>
                    <TableHead className="h-8 text-xs text-right">Cần nhập thêm</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map((p) => (
                    <TableRow key={p.id} className="text-sm">
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={p.current_stock <= 0 ? 'text-destructive font-semibold' : 'text-amber-600 font-medium'}>
                          {p.current_stock} {p.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.reorder_point} {p.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-orange-600 font-medium">
                        +{Math.max(0, p.reorder_point - p.current_stock)} {p.unit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AR breakdown */}
      <Dialog open={modal === 'ar'} onOpenChange={(o) => { if (!o) setModal(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Chi tiết công nợ phải thu — {vnd(arRows.reduce((s, r) => s + r.remaining, 0))}
            </DialogTitle>
          </DialogHeader>
          {arRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Không có công nợ nào đang mở.</p>
          ) : (
            <>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="h-8 text-xs">Mã đơn</TableHead>
                      <TableHead className="h-8 text-xs">Khách hàng</TableHead>
                      <TableHead className="h-8 text-xs text-right">Giá trị đơn</TableHead>
                      <TableHead className="h-8 text-xs text-right">Đã thu</TableHead>
                      <TableHead className="h-8 text-xs text-right">Còn lại</TableHead>
                      <TableHead className="h-8 text-xs">Ngày đặt</TableHead>
                      <TableHead className="h-8 text-xs">Thanh toán</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arRows.map((r) => {
                      const daysOld = Math.floor((Date.now() - new Date(r.order_date).getTime()) / 86400000);
                      const isOverdue = daysOld > 30;
                      return (
                        <TableRow key={r.code} className={cn('text-sm', isOverdue && 'bg-red-50/50')}>
                          <TableCell>
                            <Link href="/sales-orders" className="font-mono text-xs font-medium text-primary hover:underline">
                              {r.code}
                            </Link>
                          </TableCell>
                          <TableCell className="font-medium">{r.customer_name}</TableCell>
                          <TableCell className="text-right tabular-nums">{vnd(r.total)}</TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-700">{vnd(r.paid_amount)}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-orange-600">
                            {vnd(r.remaining)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <span>{formatDate(r.order_date)}</span>
                            {isOverdue && (
                              <span className="ml-1.5 text-destructive text-[10px] font-medium">
                                ({daysOld}d)
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={(PAY_COLOR[r.payment_status] ?? 'secondary') as 'default' | 'secondary' | 'warning' | 'success' | 'destructive'}>
                              {PAY_VN[r.payment_status] ?? r.payment_status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* Summary footer */}
              <div className="flex flex-wrap gap-6 rounded-lg bg-muted/30 px-4 py-2.5 text-sm border">
                <span>
                  <span className="text-muted-foreground">Tổng đơn: </span>
                  <strong>{vnd(arRows.reduce((s, r) => s + r.total, 0))}</strong>
                </span>
                <span>
                  <span className="text-muted-foreground">Đã thu: </span>
                  <strong className="text-emerald-700">{vnd(arRows.reduce((s, r) => s + r.paid_amount, 0))}</strong>
                </span>
                <span>
                  <span className="text-muted-foreground">Còn lại: </span>
                  <strong className="text-orange-600">{vnd(arRows.reduce((s, r) => s + r.remaining, 0))}</strong>
                </span>
                {arOverdue.length > 0 && (
                  <span>
                    <span className="text-muted-foreground">Quá hạn (&gt;30 ngày): </span>
                    <strong className="text-destructive">{vnd(arOverdue.reduce((s, r) => s + r.remaining, 0))}</strong>
                    <span className="text-muted-foreground text-xs ml-1">({arOverdue.length} đơn)</span>
                  </span>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
