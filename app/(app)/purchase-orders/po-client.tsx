'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { vnd, cny, formatDate } from '@/lib/utils';
import { updatePOStatus, recordPOPayment } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  supplier?: { name: string } | null;
}

const PO_STATUS: Record<string, { label: string; variant: 'secondary' | 'default' | 'warning' | 'success' | 'destructive' }> = {
  draft: { label: 'Nháp', variant: 'secondary' },
  sent: { label: 'Đã gửi NCC', variant: 'default' },
  confirmed: { label: 'NCC xác nhận', variant: 'default' },
  shipping: { label: 'Đang vận chuyển', variant: 'warning' },
  received: { label: 'Đã nhận hàng', variant: 'success' },
  cancelled: { label: 'Đã huỷ', variant: 'destructive' },
};
const PAY_STATUS: Record<string, { label: string; variant: 'destructive' | 'warning' | 'success' }> = {
  unpaid: { label: 'Chưa trả', variant: 'destructive' },
  partial: { label: 'Trả một phần', variant: 'warning' },
  paid: { label: 'Đã trả đủ', variant: 'success' },
};
const STATUS_FLOW = ['draft', 'sent', 'confirmed', 'shipping', 'received'];

interface Props {
  orders: PORow[];
  suppliers: EntityOption[];
  products: { id: string; label: string }[];
  defaultFxRate: number;
  canEdit: boolean;
  onQuickCreateSupplier: (name: string) => Promise<EntityOption>;
}

export function POClient({
  orders, suppliers, products, defaultFxRate, canEdit, onQuickCreateSupplier,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [formOpen, setFormOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.code.toLowerCase().includes(q) ||
        (o.supplier?.name ?? '').toLowerCase().includes(q),
    );
  }, [orders, query]);

  async function handleStatus(id: string, status: string) {
    const r = await updatePOStatus(id, status);
    if (!r.ok) {
      toast.error(r.error ?? 'Cập nhật thất bại');
      return;
    }
    toast.success('Đã cập nhật trạng thái');
    router.refresh();
  }

  async function handlePayment(o: PORow) {
    const remaining = o.total_cny - o.paid_cny;
    const input = window.prompt(
      `Nhập số tiền trả (¥). Còn lại: ${cny(remaining)}`,
      String(remaining),
    );
    if (input == null) return;
    const amount = Number(input);
    if (!amount || amount <= 0) {
      toast.error('Số tiền không hợp lệ');
      return;
    }
    const r = await recordPOPayment(o.id, amount);
    if (!r.ok) {
      toast.error(r.error ?? 'Ghi nhận thất bại');
      return;
    }
    toast.success('Đã ghi nhận thanh toán');
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã PO, nhà cung cấp..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {canEdit && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Tạo đơn nhập
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
          {query ? 'Không tìm thấy đơn nhập.' : 'Chưa có đơn nhập nào.'}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã PO</TableHead>
                <TableHead>Nhà cung cấp</TableHead>
                <TableHead>Ngày đặt</TableHead>
                <TableHead className="text-right">Tổng (¥)</TableHead>
                <TableHead className="text-right">Quy VND</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thanh toán</TableHead>
                {canEdit && <TableHead className="text-right">Thao tác</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => {
                const st = PO_STATUS[o.status] ?? PO_STATUS.draft!;
                const pay = PAY_STATUS[o.payment_status] ?? PAY_STATUS.unpaid!;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.code}</TableCell>
                    <TableCell>{o.supplier?.name ?? '—'}</TableCell>
                    <TableCell>{formatDate(o.order_date)}</TableCell>
                    <TableCell className="text-right">{cny(o.total_cny)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {vnd(o.total_vnd)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={pay.variant}>{pay.label}</Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {o.status !== 'cancelled' &&
                            o.status !== 'received' && (
                              <Select
                                value={o.status}
                                onValueChange={(v) => handleStatus(o.id, v)}
                              >
                                <SelectTrigger className="h-8 w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_FLOW.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {PO_STATUS[s]?.label ?? s}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          {o.payment_status !== 'paid' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePayment(o)}
                            >
                              Trả tiền
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Tạo đơn nhập hàng (PO)</DialogTitle>
          </DialogHeader>
          <POForm
            suppliers={suppliers}
            products={products}
            defaultFxRate={defaultFxRate}
            onQuickCreateSupplier={onQuickCreateSupplier}
            onClose={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
