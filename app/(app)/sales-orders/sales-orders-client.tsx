'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Check, X, Truck, Pencil, FilterX } from 'lucide-react';
import { toast } from 'sonner';
import { vnd, formatDate } from '@/lib/utils';
import {
  ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT,
  PAYMENT_STATUS_LABEL, PAYMENT_STATUS_VARIANT,
} from '@/lib/order-status';
import type { SalesOrderWithCustomer } from '@/lib/types';
import { approveSalesOrder, rejectSalesOrder, getSalesOrderItems } from './actions';
import { SalesOrderForm } from './sales-order-form';
import { DeliveryDialog } from './delivery-dialog';
import { SODetailDialog } from './so-detail-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { EntityOption } from '@/components/entity-combobox';

interface ProductOption {
  id: string;
  label: string;
  base_price_vnd: number;
  wholesale_price_vnd: number | null;
}

interface DraftLine {
  _key: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
}

interface Props {
  orders: SalesOrderWithCustomer[];
  customers: EntityOption[];
  products: ProductOption[];
  canCreate: boolean;
  canApprove: boolean;
  onQuickCreateCustomer: (name: string) => Promise<EntityOption>;
  onQuickCreateProduct: (name: string) => Promise<EntityOption>;
}

const FI = 'h-6 w-full rounded border border-input bg-background px-1.5 text-[11px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring';
const FS = 'h-6 w-full rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring';
const FD = 'h-6 rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring';

export function SalesOrdersClient({
  orders, customers, products, canCreate, canApprove,
  onQuickCreateCustomer, onQuickCreateProduct,
}: Props) {
  const router = useRouter();

  const [fCode, setFCode] = React.useState('');
  const [fCustomer, setFCustomer] = React.useState('');
  const [fDateFrom, setFDateFrom] = React.useState('');
  const [fDateTo, setFDateTo] = React.useState('');
  const [fStatus, setFStatus] = React.useState('');
  const [fPayment, setFPayment] = React.useState('');

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingOrder, setEditingOrder] = React.useState<SalesOrderWithCustomer | null>(null);
  const [editingItems, setEditingItems] = React.useState<DraftLine[]>([]);
  const [loadingEdit, setLoadingEdit] = React.useState<string | null>(null);
  const [deliverOrderId, setDeliverOrderId] = React.useState<string | null>(null);
  const [deliverOrderCode, setDeliverOrderCode] = React.useState('');
  const [detailOrderId, setDetailOrderId] = React.useState<string | null>(null);

  const hasFilter = !!(fCode || fCustomer || fDateFrom || fDateTo || fStatus || fPayment);

  function clearFilters() {
    setFCode(''); setFCustomer(''); setFDateFrom(''); setFDateTo('');
    setFStatus(''); setFPayment('');
  }

  const filtered = React.useMemo(() => {
    return orders.filter((o) => {
      const d = String(o.order_date).slice(0, 10);
      if (fCode && !o.code.toLowerCase().includes(fCode.toLowerCase())) return false;
      if (fCustomer && !(o.customer?.name ?? '').toLowerCase().includes(fCustomer.toLowerCase())) return false;
      if (fDateFrom && d < fDateFrom) return false;
      if (fDateTo && d > fDateTo) return false;
      if (fStatus && o.status !== fStatus) return false;
      if (fPayment && o.payment_status !== fPayment) return false;
      return true;
    });
  }, [orders, fCode, fCustomer, fDateFrom, fDateTo, fStatus, fPayment]);

  const summary = React.useMemo(() => ({
    revenue: filtered.reduce((s, o) => s + o.total, 0),
    paid: filtered.reduce((s, o) => s + (o.paid_amount ?? 0), 0),
    deposit: filtered.reduce((s, o) => s + (o.deposit_amount ?? 0), 0),
  }), [filtered]);

  async function handleApprove(id: string) {
    const r = await approveSalesOrder(id);
    if (!r.ok) { toast.error(r.error ?? 'Duyệt thất bại'); return; }
    toast.success('Đã duyệt đơn');
    router.refresh();
  }

  async function handleOpenEdit(order: SalesOrderWithCustomer) {
    setLoadingEdit(order.id);
    const r = await getSalesOrderItems(order.id);
    setLoadingEdit(null);
    if (!r.ok || !r.items) { toast.error('Không tải được dòng hàng'); return; }
    setEditingItems(r.items.map((it) => ({ ...it, _key: crypto.randomUUID() })));
    setEditingOrder(order);
  }

  async function handleReject(id: string) {
    const reason = window.prompt('Lý do từ chối đơn:');
    if (reason == null) return;
    const r = await rejectSalesOrder(id, reason);
    if (!r.ok) { toast.error(r.error ?? 'Từ chối thất bại'); return; }
    toast.success('Đã từ chối đơn');
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {hasFilter ? `${filtered.length} / ${orders.length} đơn` : `${orders.length} đơn`}
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="ml-2 inline-flex items-center gap-1 text-xs text-destructive hover:underline"
            >
              <FilterX className="h-3 w-3" />Xoá bộ lọc
            </button>
          )}
        </p>
        {canCreate && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Tạo đơn
          </Button>
        )}
      </div>

      {/* Summary khi có bộ lọc */}
      {hasFilter && (
        <div className="flex flex-wrap gap-6 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
          <span>
            <span className="text-muted-foreground">Doanh thu: </span>
            <strong>{vnd(summary.revenue)}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Đã thu: </span>
            <strong className="text-emerald-700">{vnd(summary.paid)}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Còn lại: </span>
            <strong className={summary.revenue - summary.paid > 0 ? 'text-orange-600' : 'text-emerald-700'}>
              {vnd(Math.max(0, summary.revenue - summary.paid))}
            </strong>
          </span>
          {summary.deposit > 0 && (
            <span>
              <span className="text-muted-foreground">Đã cọc: </span>
              <strong className="text-blue-600">{vnd(summary.deposit)}</strong>
            </span>
          )}
        </div>
      )}

      {/* Bảng với filter ngay trong header */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            {/* Hàng nhãn cột */}
            <TableRow className="border-b-0 bg-muted/50 hover:bg-muted/50">
              <TableHead className="h-8 px-3 text-xs font-semibold w-[110px]">Mã đơn</TableHead>
              <TableHead className="h-8 px-3 text-xs font-semibold">Khách hàng</TableHead>
              <TableHead className="h-8 px-3 text-xs font-semibold w-[230px]">Ngày đặt</TableHead>
              <TableHead className="h-8 px-3 text-xs font-semibold text-right w-[130px]">Tổng tiền</TableHead>
              <TableHead className="h-8 px-3 text-xs font-semibold w-[130px]">Trạng thái</TableHead>
              <TableHead className="h-8 px-3 text-xs font-semibold w-[130px]">Thanh toán</TableHead>
              <TableHead className="h-8 px-3 text-xs font-semibold w-[90px]">NV tạo</TableHead>
              <TableHead className="h-8 w-[150px]" />
            </TableRow>
            {/* Hàng filter */}
            <TableRow className="bg-muted/20 hover:bg-muted/20 border-b">
              <TableHead className="py-1.5 px-2">
                <input
                  className={FI} placeholder="Mã..." value={fCode}
                  onChange={(e) => setFCode(e.target.value)}
                />
              </TableHead>
              <TableHead className="py-1.5 px-2">
                <input
                  className={FI} placeholder="Tìm khách hàng..." value={fCustomer}
                  onChange={(e) => setFCustomer(e.target.value)}
                />
              </TableHead>
              <TableHead className="py-1.5 px-2">
                <div className="flex items-center gap-1">
                  <input
                    type="date" className={FD + ' flex-1'} value={fDateFrom}
                    onChange={(e) => setFDateFrom(e.target.value)}
                  />
                  <span className="text-[10px] text-muted-foreground shrink-0">→</span>
                  <input
                    type="date" className={FD + ' flex-1'} value={fDateTo}
                    onChange={(e) => setFDateTo(e.target.value)}
                  />
                </div>
              </TableHead>
              <TableHead className="py-1.5 px-2" />
              <TableHead className="py-1.5 px-2">
                <select className={FS} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                  <option value="">Tất cả</option>
                  <option value="draft">Nháp</option>
                  <option value="pending_approval">Chờ duyệt</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="processing">Đang xử lý</option>
                  <option value="partial_delivered">Giao một phần</option>
                  <option value="delivered">Đã giao</option>
                  <option value="completed">Hoàn tất</option>
                  <option value="cancelled">Đã huỷ</option>
                </select>
              </TableHead>
              <TableHead className="py-1.5 px-2">
                <select className={FS} value={fPayment} onChange={(e) => setFPayment(e.target.value)}>
                  <option value="">Tất cả</option>
                  <option value="unpaid">Chưa thu</option>
                  <option value="partial">Thu một phần</option>
                  <option value="paid">Đã thu đủ</option>
                  <option value="overpaid">Thu vượt</option>
                </select>
              </TableHead>
              <TableHead className="py-1.5" />
              <TableHead className="py-1.5" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  {hasFilter ? 'Không có đơn nào khớp bộ lọc.' : 'Chưa có đơn bán nào.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((o) => (
                <TableRow key={o.id} className="text-sm">
                  <TableCell className="py-2 px-3 font-medium">
                    <button
                      className="hover:underline text-primary font-mono text-xs"
                      onClick={() => setDetailOrderId(o.id)}
                    >
                      {o.code}
                    </button>
                  </TableCell>
                  <TableCell className="py-2 px-3">{o.customer?.name ?? '—'}</TableCell>
                  <TableCell className="py-2 px-3 text-muted-foreground text-xs">
                    {formatDate(o.order_date)}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-right font-semibold tabular-nums">
                    {vnd(o.total)}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <Badge variant={PAYMENT_STATUS_VARIANT[o.payment_status]}>
                      {PAYMENT_STATUS_LABEL[o.payment_status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                    {o.creator?.full_name ?? '—'}
                  </TableCell>
                  <TableCell className="py-2 px-2">
                    <div className="flex justify-end gap-1">
                      {canCreate && !['completed', 'cancelled'].includes(o.status) && (
                        <Button
                          size="icon" variant="ghost"
                          disabled={loadingEdit === o.id}
                          onClick={() => handleOpenEdit(o)}
                        >
                          {loadingEdit === o.id
                            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            : <Pencil className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      {canApprove && o.status === 'pending_approval' && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => handleApprove(o.id)}>
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleReject(o.id)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {['approved', 'partial_delivered'].includes(o.status) && (
                        <Button
                          size="sm" variant="outline"
                          onClick={() => { setDeliverOrderId(o.id); setDeliverOrderCode(o.code); }}
                        >
                          <Truck className="h-3.5 w-3.5" />
                          Giao
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Tổng kết footer khi có data */}
      {filtered.length > 0 && (
        <p className="text-right text-xs text-muted-foreground pr-1">
          {filtered.length} đơn &nbsp;·&nbsp; Tổng: <strong className="text-foreground">{vnd(summary.revenue)}</strong>
        </p>
      )}

      {/* Dialogs */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tạo đơn bán mới</DialogTitle></DialogHeader>
          <SalesOrderForm
            customers={customers} products={products}
            onQuickCreateCustomer={onQuickCreateCustomer}
            onQuickCreateProduct={onQuickCreateProduct}
            onClose={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editingOrder !== null} onOpenChange={(o) => { if (!o) setEditingOrder(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sửa đơn {editingOrder?.code}</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <SalesOrderForm
              customers={customers} products={products}
              onQuickCreateCustomer={onQuickCreateCustomer}
              onQuickCreateProduct={onQuickCreateProduct}
              onClose={() => setEditingOrder(null)}
              editing={{
                id: editingOrder.id,
                customer_id: editingOrder.customer_id,
                order_date: editingOrder.order_date,
                delivery_date: (editingOrder as unknown as Record<string, unknown>).delivery_date as string | null ?? null,
                delivery_address: (editingOrder as unknown as Record<string, unknown>).delivery_address as string | null ?? null,
                notes: (editingOrder as unknown as Record<string, unknown>).notes as string | null ?? null,
                deposit_amount: Number((editingOrder as unknown as Record<string, unknown>).deposit_amount ?? 0),
                discount_amount: Number((editingOrder as unknown as Record<string, unknown>).discount_amount ?? 0),
                shipping_fee: Number((editingOrder as unknown as Record<string, unknown>).shipping_fee ?? 0),
              }}
              editingItems={editingItems}
            />
          )}
        </DialogContent>
      </Dialog>

      <DeliveryDialog
        orderId={deliverOrderId}
        orderCode={deliverOrderCode}
        open={deliverOrderId !== null}
        onOpenChange={(o) => { if (!o) setDeliverOrderId(null); }}
      />

      <SODetailDialog
        orderId={detailOrderId}
        open={detailOrderId !== null}
        onOpenChange={(o) => { if (!o) setDetailOrderId(null); }}
        canApprove={canApprove}
      />
    </div>
  );
}
