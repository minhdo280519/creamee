'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { vnd, formatDate } from '@/lib/utils';
import {
  ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT, ORDER_TRANSITIONS,
  PAYMENT_STATUS_LABEL, PAYMENT_STATUS_VARIANT,
} from '@/lib/order-status';
import type { OrderStatus } from '@/lib/types';
import { getSODetail, updateOrderStatus, type SODetailData } from './actions';
import { DeliveryDialog } from './delivery-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const PO_STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp', ordered: 'Đã đặt', sent: 'Đã gửi NCC',
  confirmed: 'NCC xác nhận', shipping: 'Đang vận chuyển',
  received: 'Đã nhận hàng', cancelled: 'Đã huỷ',
};

interface Props {
  orderId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canApprove: boolean;
}

export function SODetailDialog({ orderId, open, onOpenChange, canApprove }: Props) {
  const router = useRouter();
  const [data, setData] = React.useState<SODetailData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [changingStatus, setChangingStatus] = React.useState(false);
  const [deliverOpen, setDeliverOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open || !orderId) { setData(null); return; }
    setLoading(true);
    getSODetail(orderId).then((r) => {
      if (r.ok && r.data) setData(r.data);
      else toast.error(r.error ?? 'Không tải được chi tiết');
      setLoading(false);
    });
  }, [open, orderId]);

  async function handleStatusChange(newStatus: string) {
    if (!orderId) return;
    setChangingStatus(true);
    const r = await updateOrderStatus(orderId, newStatus);
    setChangingStatus(false);
    if (!r.ok) { toast.error(r.error ?? 'Cập nhật thất bại'); return; }
    toast.success('Đã cập nhật trạng thái');
    router.refresh();
    // Reload detail
    const r2 = await getSODetail(orderId);
    if (r2.ok && r2.data) setData(r2.data);
  }

  const transitions = data ? (ORDER_TRANSITIONS[data.status as OrderStatus] ?? []) : [];
  const canChangeStatus = canApprove && transitions.length > 0;
  const canDeliver = data && ['approved', 'partial_delivered', 'processing'].includes(data.status);

  const paidToUse = data ? Math.max(data.paid_amount, data.cashPaid) : 0;
  const remaining = data ? Math.max(0, data.total - paidToUse - data.deposit_amount) : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết đơn bán — {data?.code ?? '...'}</DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && data && (
            <div className="space-y-5">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <div><span className="text-muted-foreground">Khách hàng:</span> <span className="font-medium">{data.customer_name}</span> <span className="text-xs text-muted-foreground">({data.customer_code})</span></div>
                <div><span className="text-muted-foreground">Ngày đặt:</span> <span className="font-medium">{formatDate(data.order_date)}</span></div>
                {data.delivery_date && <div><span className="text-muted-foreground">Ngày giao:</span> <span className="font-medium">{formatDate(data.delivery_date)}</span></div>}
                {data.delivery_address && <div className="col-span-2 sm:col-span-3"><span className="text-muted-foreground">Địa chỉ:</span> {data.delivery_address}</div>}
                {data.notes && <div className="col-span-2 sm:col-span-3"><span className="text-muted-foreground">Ghi chú:</span> {data.notes}</div>}
                {data.created_by_name && <div><span className="text-muted-foreground">NV tạo:</span> {data.created_by_name}</div>}
                {data.approved_by_name && <div><span className="text-muted-foreground">Người duyệt:</span> {data.approved_by_name}</div>}
              </div>

              {/* Status row */}
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={ORDER_STATUS_VARIANT[data.status as OrderStatus]}>
                  {ORDER_STATUS_LABEL[data.status as OrderStatus] ?? data.status}
                </Badge>
                <Badge variant={PAYMENT_STATUS_VARIANT[data.payment_status as 'unpaid' | 'partial' | 'paid' | 'overpaid']}>
                  {PAYMENT_STATUS_LABEL[data.payment_status as 'unpaid' | 'partial' | 'paid' | 'overpaid']}
                </Badge>
                {canChangeStatus && (
                  <div className="flex items-center gap-2 ml-auto">
                    {changingStatus && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Select onValueChange={handleStatusChange} disabled={changingStatus}>
                      <SelectTrigger className="h-8 w-44">
                        <SelectValue placeholder="Đổi trạng thái…" />
                      </SelectTrigger>
                      <SelectContent>
                        {transitions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {ORDER_STATUS_LABEL[s] ?? s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {canDeliver && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => setDeliverOpen(true)}
                  >
                    <Truck className="h-3.5 w-3.5 mr-1" />
                    Giao hàng
                  </Button>
                )}
              </div>

              {/* Items table */}
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead className="text-right">SL đặt</TableHead>
                      <TableHead className="text-right">Đơn giá</TableHead>
                      <TableHead className="text-right">CK%</TableHead>
                      <TableHead className="text-right">Thành tiền</TableHead>
                      <TableHead className="text-right">Đã giao</TableHead>
                      <TableHead className="text-right">Còn lại</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{vnd(item.unit_price)}</TableCell>
                        <TableCell className="text-right">{item.discount_pct > 0 ? `${item.discount_pct}%` : '—'}</TableCell>
                        <TableCell className="text-right font-medium">{vnd(item.line_total)}</TableCell>
                        <TableCell className="text-right text-emerald-700">{item.delivered_qty}</TableCell>
                        <TableCell className={`text-right font-semibold ${item.quantity - item.delivered_qty > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {item.quantity - item.delivered_qty}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Financial summary */}
              <div className="ml-auto max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Tạm tính</span><span>{vnd(data.subtotal)}</span></div>
                {data.discount_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Chiết khấu</span><span className="text-destructive">− {vnd(data.discount_amount)}</span></div>}
                {data.shipping_fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Phí ship</span><span>+ {vnd(data.shipping_fee)}</span></div>}
                <div className="flex justify-between border-t pt-1.5 font-semibold text-base"><span>Tổng cộng</span><span>{vnd(data.total)}</span></div>
                {data.deposit_amount > 0 && <div className="flex justify-between text-blue-700"><span>Tiền cọc</span><span>− {vnd(data.deposit_amount)}</span></div>}
                {paidToUse > 0 && <div className="flex justify-between text-emerald-700"><span>Đã thanh toán</span><span>− {vnd(paidToUse)}</span></div>}
                {data.cashPaid > 0 && data.cashPaid !== data.paid_amount && (
                  <div className="text-xs text-muted-foreground text-right">(từ phiếu thu: {vnd(data.cashPaid)})</div>
                )}
                <div className={`flex justify-between border-t pt-1.5 font-semibold ${remaining > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  <span>Còn lại</span><span>{remaining > 0 ? vnd(remaining) : 'Đã thanh toán đủ'}</span>
                </div>
              </div>

              {/* Related POs */}
              {data.relatedPOs.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Đơn nhập hàng liên quan</h4>
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mã PO</TableHead>
                          <TableHead>Nhà cung cấp</TableHead>
                          <TableHead>Ngày đặt</TableHead>
                          <TableHead>Trạng thái</TableHead>
                          <TableHead className="text-right">Tổng VND</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.relatedPOs.map((po) => (
                          <TableRow key={po.id}>
                            <TableCell className="font-medium">{po.code}</TableCell>
                            <TableCell>{po.supplier_name ?? '—'}</TableCell>
                            <TableCell>{formatDate(po.order_date)}</TableCell>
                            <TableCell><Badge variant="secondary">{PO_STATUS_LABEL[po.status] ?? po.status}</Badge></TableCell>
                            <TableCell className="text-right">{vnd(po.total_vnd)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {data && (
        <DeliveryDialog
          orderId={deliverOpen ? data.id : null}
          orderCode={data.code}
          open={deliverOpen}
          onOpenChange={(o) => {
            setDeliverOpen(o);
            if (!o && orderId) {
              getSODetail(orderId).then((r) => { if (r.ok && r.data) setData(r.data); });
              router.refresh();
            }
          }}
        />
      )}
    </>
  );
}
