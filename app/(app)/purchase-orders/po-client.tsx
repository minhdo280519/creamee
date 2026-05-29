'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FilterX } from 'lucide-react';
import { toast } from 'sonner';
import { vnd, cny, formatDate } from '@/lib/utils';
import { updatePOStatus, recordPOPayment } from './actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { POForm } from './po-form';
import { PODetailDialog } from './po-detail-dialog';
import type { EntityOption } from '@/components/entity-combobox';

interface PORow {
  id: string;
  code: string;
  order_date: string;
  expected_arrival_date: string | null;
  total_cny: number;
  total_vnd: number;
  paid_cny: number;
  status: string;
  payment_status: string;
  so_code?: string | null;
  supplier?: { name: string } | null;
}

const PO_STATUS: Record<string, { label: string; variant: 'secondary' | 'default' | 'warning' | 'success' | 'destructive' }> = {
  draft:     { label: 'Nháp',              variant: 'secondary' },
  sent:      { label: 'Đã gửi NCC',        variant: 'default' },
  confirmed: { label: 'NCC xác nhận',      variant: 'default' },
  shipping:  { label: 'Đang vận chuyển',   variant: 'warning' },
  received:  { label: 'Đã nhận hàng',      variant: 'success' },
  cancelled: { label: 'Đã huỷ',            variant: 'destructive' },
};
const PAY_STATUS: Record<string, { label: string; variant: 'destructive' | 'warning' | 'success' }> = {
  unpaid:  { label: 'Chưa trả',      variant: 'destructive' },
  partial: { label: 'Trả một phần',  variant: 'warning' },
  paid:    { label: 'Đã trả đủ',     variant: 'success' },
};
const STATUS_FLOW = ['draft', 'sent', 'confirmed', 'shipping', 'received'];

interface SOOption { id: string; code: string; customer_name: string; }

interface Props {
  orders: PORow[];
  suppliers: EntityOption[];
  products: { id: string; label: string }[];
  salesOrders: SOOption[];
  defaultFxRate: number;
  canEdit: boolean;
  onQuickCreateSupplier: (name: string) => Promise<EntityOption>;
  onQuickCreateProduct:  (name: string) => Promise<EntityOption>;
}

const FI = 'h-6 w-full rounded border border-input bg-background px-1.5 text-[11px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring';
const FS = 'h-6 w-full rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring';
const FD = 'h-6 rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring';

export function POClient({
  orders, suppliers, products, salesOrders, defaultFxRate, canEdit,
  onQuickCreateSupplier, onQuickCreateProduct,
}: Props) {
  const router = useRouter();

  const [fCode, setFCode] = React.useState('');
  const [fSupplier, setFSupplier] = React.useState('');
  const [fDateFrom, setFDateFrom] = React.useState('');
  const [fDateTo, setFDateTo] = React.useState('');
  const [fStatus, setFStatus] = React.useState('');
  const [fPayment, setFPayment] = React.useState('');

  const [formOpen, setFormOpen] = React.useState(false);
  const [detailPoId, setDetailPoId] = React.useState<string | null>(null);

  const hasFilter = !!(fCode || fSupplier || fDateFrom || fDateTo || fStatus || fPayment);

  function clearFilters() {
    setFCode(''); setFSupplier(''); setFDateFrom(''); setFDateTo('');
    setFStatus(''); setFPayment('');
  }

  const filtered = React.useMemo(() => {
    return orders.filter((o) => {
      const d = String(o.order_date).slice(0, 10);
      if (fCode && !o.code.toLowerCase().includes(fCode.toLowerCase())) return false;
      if (fSupplier && !(o.supplier?.name ?? '').toLowerCase().includes(fSupplier.toLowerCase())) return false;
      if (fDateFrom && d < fDateFrom) return false;
      if (fDateTo && d > fDateTo) return false;
      if (fStatus && o.status !== fStatus) return false;
      if (fPayment && o.payment_status !== fPayment) return false;
      return true;
    });
  }, [orders, fCode, fSupplier, fDateFrom, fDateTo, fStatus, fPayment]);

  const summary = React.useMemo(() => ({
    total_cny: filtered.reduce((s, o) => s + o.total_cny, 0),
    total_vnd: filtered.reduce((s, o) => s + o.total_vnd, 0),
    paid_cny:  filtered.reduce((s, o) => s + o.paid_cny, 0),
  }), [filtered]);

  async function handleStatus(id: string, status: string) {
    const r = await updatePOStatus(id, status);
    if (!r.ok) { toast.error(r.error ?? 'Cập nhật thất bại'); return; }
    toast.success('Đã cập nhật trạng thái');
    router.refresh();
  }

  async function handlePayment(o: PORow) {
    const remaining = o.total_cny - o.paid_cny;
    const input = window.prompt(`Nhập số tiền trả (¥). Còn lại: ${cny(remaining)}`, String(remaining));
    if (input == null) return;
    const amount = Number(input);
    if (!amount || amount <= 0) { toast.error('Số tiền không hợp lệ'); return; }
    const r = await recordPOPayment(o.id, amount);
    if (!r.ok) { toast.error(r.error ?? 'Ghi nhận thất bại'); return; }
    toast.success('Đã ghi nhận thanh toán');
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {hasFilter ? `${filtered.length} / ${orders.length} đơn nhập` : `${orders.length} đơn nhập`}
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="ml-2 inline-flex items-center gap-1 text-xs text-destructive hover:underline"
            >
              <FilterX className="h-3 w-3" />Xoá bộ lọc
            </button>
          )}
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Tạo đơn nhập
          </Button>
        )}
      </div>

      {/* Summary khi có bộ lọc */}
      {hasFilter && (
        <div className="flex flex-wrap gap-6 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
          <span>
            <span className="text-muted-foreground">Tổng: </span>
            <strong>{cny(summary.total_cny)} = {vnd(summary.total_vnd)}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Đã trả: </span>
            <strong className="text-emerald-700">{cny(summary.paid_cny)}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Còn nợ NCC: </span>
            <strong className={summary.total_cny - summary.paid_cny > 0 ? 'text-orange-600' : 'text-emerald-700'}>
              {cny(Math.max(0, summary.total_cny - summary.paid_cny))}
            </strong>
          </span>
        </div>
      )}

      {/* Bảng với filter ngay trong header */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            {/* Hàng nhãn cột */}
            <TableRow className="border-b-0 bg-muted/50 hover:bg-muted/50">
              <TableHead className="h-8 px-3 text-xs font-semibold w-[110px]">Mã PO</TableHead>
              <TableHead className="h-8 px-3 text-xs font-semibold">Nhà cung cấp</TableHead>
              <TableHead className="h-8 px-3 text-xs font-semibold w-[80px]">Đơn bán</TableHead>
              <TableHead className="h-8 px-3 text-xs font-semibold w-[230px]">Ngày đặt</TableHead>
              <TableHead className="h-8 px-3 text-xs font-semibold text-right w-[110px]">Tổng (¥)</TableHead>
              <TableHead className="h-8 px-3 text-xs font-semibold text-right w-[130px]">Quy VND</TableHead>
              <TableHead className="h-8 px-3 text-xs font-semibold w-[130px]">Trạng thái</TableHead>
              <TableHead className="h-8 px-3 text-xs font-semibold w-[120px]">Thanh toán</TableHead>
              {canEdit && <TableHead className="h-8 w-[180px]" />}
            </TableRow>
            {/* Hàng filter */}
            <TableRow className="bg-muted/20 hover:bg-muted/20 border-b">
              <TableHead className="py-1.5 px-2">
                <input className={FI} placeholder="Mã PO..." value={fCode} onChange={(e) => setFCode(e.target.value)} />
              </TableHead>
              <TableHead className="py-1.5 px-2">
                <input className={FI} placeholder="Tìm nhà cung cấp..." value={fSupplier} onChange={(e) => setFSupplier(e.target.value)} />
              </TableHead>
              <TableHead className="py-1.5 px-2" />
              <TableHead className="py-1.5 px-2">
                <div className="flex items-center gap-1">
                  <input type="date" className={FD + ' flex-1'} value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} />
                  <span className="text-[10px] text-muted-foreground shrink-0">→</span>
                  <input type="date" className={FD + ' flex-1'} value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} />
                </div>
              </TableHead>
              <TableHead className="py-1.5 px-2" />
              <TableHead className="py-1.5 px-2" />
              <TableHead className="py-1.5 px-2">
                <select className={FS} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                  <option value="">Tất cả</option>
                  <option value="draft">Nháp</option>
                  <option value="sent">Đã gửi NCC</option>
                  <option value="confirmed">NCC xác nhận</option>
                  <option value="shipping">Đang vận chuyển</option>
                  <option value="received">Đã nhận hàng</option>
                  <option value="cancelled">Đã huỷ</option>
                </select>
              </TableHead>
              <TableHead className="py-1.5 px-2">
                <select className={FS} value={fPayment} onChange={(e) => setFPayment(e.target.value)}>
                  <option value="">Tất cả</option>
                  <option value="unpaid">Chưa trả</option>
                  <option value="partial">Trả một phần</option>
                  <option value="paid">Đã trả đủ</option>
                </select>
              </TableHead>
              {canEdit && <TableHead className="py-1.5" />}
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 9 : 8} className="py-12 text-center text-sm text-muted-foreground">
                  {hasFilter ? 'Không có đơn nào khớp bộ lọc.' : 'Chưa có đơn nhập nào.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((o) => {
                const st = PO_STATUS[o.status] ?? PO_STATUS.draft!;
                const pay = PAY_STATUS[o.payment_status] ?? PAY_STATUS.unpaid!;
                return (
                  <TableRow key={o.id} className="text-sm">
                    <TableCell className="py-2 px-3 font-medium">
                      <button
                        className="hover:underline text-primary font-mono text-xs"
                        onClick={() => setDetailPoId(o.id)}
                      >
                        {o.code}
                      </button>
                    </TableCell>
                    <TableCell className="py-2 px-3">{o.supplier?.name ?? '—'}</TableCell>
                    <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                      {o.so_code ?? '—'}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                      {formatDate(o.order_date)}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-right tabular-nums">
                      {cny(o.total_cny)}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-right font-semibold tabular-nums">
                      {vnd(o.total_vnd)}
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <Badge variant={pay.variant}>{pay.label}</Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell className="py-2 px-2">
                        <div className="flex justify-end gap-1">
                          {o.status !== 'cancelled' && o.status !== 'received' && (
                            <Select value={o.status} onValueChange={(v) => handleStatus(o.id, v)}>
                              <SelectTrigger className="h-7 w-36 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_FLOW.map((s) => (
                                  <SelectItem key={s} value={s} className="text-xs">
                                    {PO_STATUS[s]?.label ?? s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {o.payment_status !== 'paid' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handlePayment(o)}>
                              Trả tiền
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer tổng */}
      {filtered.length > 0 && (
        <p className="text-right text-xs text-muted-foreground pr-1">
          {filtered.length} đơn &nbsp;·&nbsp;
          Tổng: <strong className="text-foreground">{cny(summary.total_cny)}</strong>
          &nbsp;=&nbsp;
          <strong className="text-foreground">{vnd(summary.total_vnd)}</strong>
        </p>
      )}

      {/* Dialogs */}
      <PODetailDialog
        poId={detailPoId}
        open={detailPoId !== null}
        onOpenChange={(o) => { if (!o) setDetailPoId(null); }}
        canEdit={canEdit}
        salesOrders={salesOrders}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo đơn nhập hàng (PO)</DialogTitle>
          </DialogHeader>
          <POForm
            suppliers={suppliers}
            products={products}
            salesOrders={salesOrders}
            defaultFxRate={defaultFxRate}
            onQuickCreateSupplier={onQuickCreateSupplier}
            onQuickCreateProduct={onQuickCreateProduct}
            onClose={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
