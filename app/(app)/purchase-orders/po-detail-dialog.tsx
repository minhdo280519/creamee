'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { vnd, cny, formatDate } from '@/lib/utils';
import { getPODetail, updatePOStatus, updatePOItemSOLink, type PODetailData } from './actions';
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

const PO_STATUS: Record<string, { label: string; variant: 'secondary' | 'default' | 'warning' | 'success' | 'destructive' }> = {
  draft:     { label: 'Nháp',              variant: 'secondary' },
  sent:      { label: 'Đã gửi NCC',        variant: 'default' },
  confirmed: { label: 'NCC xác nhận',      variant: 'default' },
  shipping:  { label: 'Đang vận chuyển',   variant: 'warning' },
  received:  { label: 'Đã nhận hàng',      variant: 'success' },
  cancelled: { label: 'Đã huỷ',            variant: 'destructive' },
};

const PO_STATUS_FLOW = ['draft', 'sent', 'confirmed', 'shipping', 'received'];

const PAY_STATUS: Record<string, { label: string; variant: 'destructive' | 'warning' | 'success' }> = {
  unpaid:  { label: 'Chưa trả',      variant: 'destructive' },
  partial: { label: 'Trả một phần',  variant: 'warning' },
  paid:    { label: 'Đã trả đủ',     variant: 'success' },
};

interface SOOption { id: string; code: string; customer_name: string }

interface Props {
  poId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canEdit: boolean;
  salesOrders: SOOption[];
}

export function PODetailDialog({ poId, open, onOpenChange, canEdit, salesOrders }: Props) {
  const router = useRouter();
  const [data, setData] = React.useState<PODetailData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [changingStatus, setChangingStatus] = React.useState(false);
  const [linkingItem, setLinkingItem] = React.useState<string | null>(null);

  async function reload() {
    if (!poId) return;
    const r = await getPODetail(poId);
    if (r.ok && r.data) setData(r.data);
  }

  React.useEffect(() => {
    if (!open || !poId) { setData(null); return; }
    setLoading(true);
    getPODetail(poId).then((r) => {
      if (r.ok && r.data) setData(r.data);
      else toast.error(r.error ?? 'Không tải được chi tiết');
      setLoading(false);
    });
  }, [open, poId]);

  async function handleStatusChange(newStatus: string) {
    if (!poId) return;
    setChangingStatus(true);
    const r = await updatePOStatus(poId, newStatus);
    setChangingStatus(false);
    if (!r.ok) { toast.error(r.error ?? 'Cập nhật thất bại'); return; }
    toast.success('Đã cập nhật trạng thái');
    router.refresh();
    reload();
  }

  async function handleItemSOLink(itemId: string, soId: string) {
    setLinkingItem(itemId);
    const so = soId ? salesOrders.find((s) => s.id === soId) : null;
    const r = await updatePOItemSOLink(itemId, so?.id ?? null, so?.code ?? null);
    setLinkingItem(null);
    if (!r.ok) { toast.error(r.error ?? 'Lỗi'); return; }
    toast.success('Đã gắn SO');
    reload();
  }

  const st = data ? PO_STATUS[data.status] : null;
  const pay = data ? PAY_STATUS[data.payment_status] : null;
  const remaining = data ? Math.max(0, data.total_cny - data.paid_cny) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chi tiết đơn nhập — {data?.code ?? '...'}</DialogTitle>
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
              <div><span className="text-muted-foreground">Nhà cung cấp:</span> <span className="font-medium">{data.supplier_name}</span> <span className="text-xs text-muted-foreground">({data.supplier_code})</span></div>
              <div><span className="text-muted-foreground">Ngày đặt:</span> <span className="font-medium">{formatDate(data.order_date)}</span></div>
              {data.expected_arrival_date && <div><span className="text-muted-foreground">Dự kiến về:</span> <span className="font-medium">{formatDate(data.expected_arrival_date)}</span></div>}
              {data.so_code && <div><span className="text-muted-foreground">Đơn bán:</span> <span className="font-medium text-primary">{data.so_code}</span></div>}
              <div><span className="text-muted-foreground">Tỷ giá:</span> {data.fx_rate.toLocaleString('vi')} VND/¥</div>
              {data.notes && <div className="col-span-2 sm:col-span-3"><span className="text-muted-foreground">Ghi chú:</span> {data.notes}</div>}
              {data.created_by_name && <div><span className="text-muted-foreground">NV tạo:</span> {data.created_by_name}</div>}
            </div>

            {/* Status row */}
            <div className="flex flex-wrap items-center gap-3">
              {st && <Badge variant={st.variant}>{st.label}</Badge>}
              {pay && <Badge variant={pay.variant}>{pay.label}</Badge>}
              {canEdit && data.status !== 'cancelled' && data.status !== 'received' && (
                <div className="flex items-center gap-2 ml-auto">
                  {changingStatus && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Select onValueChange={handleStatusChange} disabled={changingStatus} value={data.status}>
                    <SelectTrigger className="h-8 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PO_STATUS_FLOW.map((s) => (
                        <SelectItem key={s} value={s}>
                          {PO_STATUS[s]?.label ?? s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Items table */}
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead className="text-right">SL đặt</TableHead>
                    <TableHead className="text-right">Đã nhận</TableHead>
                    <TableHead className="text-right">Giá nhập (¥)</TableHead>
                    <TableHead className="text-right">Thành tiền (¥)</TableHead>
                    <TableHead className="w-48">Gắn với SO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className={`text-right ${item.received_qty < item.quantity ? 'text-amber-600 font-semibold' : 'text-emerald-700'}`}>
                        {item.received_qty}
                      </TableCell>
                      <TableCell className="text-right">{cny(item.unit_cost_cny)}</TableCell>
                      <TableCell className="text-right font-medium">{cny(item.line_total_cny)}</TableCell>
                      <TableCell>
                        {canEdit ? (
                          <div className="flex items-center gap-1">
                            {linkingItem === item.id && <Loader2 className="h-3 w-3 animate-spin" />}
                            <Select
                              value={item.so_id ?? ''}
                              onValueChange={(v) => handleItemSOLink(item.id, v)}
                              disabled={linkingItem === item.id}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Chọn SO…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">— Không gắn —</SelectItem>
                                {salesOrders.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.code} · {s.customer_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <span className="text-sm text-primary">{item.so_code ?? '—'}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Financial summary */}
            <div className="ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tiền hàng</span><span>{cny(data.subtotal_cny)}</span></div>
              {data.shipping_cny > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Phí vận chuyển</span><span>+ {cny(data.shipping_cny)}</span></div>}
              <div className="flex justify-between border-t pt-1.5 font-semibold"><span>Tổng (¥)</span><span>{cny(data.total_cny)}</span></div>
              <div className="flex justify-between text-primary font-semibold"><span>Quy VND</span><span>{vnd(data.total_vnd)}</span></div>
              {data.paid_cny > 0 && <div className="flex justify-between text-emerald-700"><span>Đã trả (¥)</span><span>− {cny(data.paid_cny)}</span></div>}
              {remaining > 0 && <div className="flex justify-between border-t pt-1.5 font-semibold text-amber-700"><span>Còn nợ (¥)</span><span>{cny(remaining)}</span></div>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
