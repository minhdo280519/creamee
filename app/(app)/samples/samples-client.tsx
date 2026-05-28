'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Check, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { vnd, formatDate } from '@/lib/utils';
import { updateSample } from './actions';
import { calcMaxRefund } from '@/lib/sample-business';
import type { SampleWithRelations } from '@/lib/types';
import { SampleForm } from './sample-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { EntityOption } from '@/components/entity-combobox';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  cancelled: 'Đã huỷ',
};
const STATUS_VARIANT: Record<string, 'secondary' | 'success' | 'destructive'> = {
  pending: 'secondary',
  approved: 'success',
  cancelled: 'destructive',
};

interface Props {
  samples: SampleWithRelations[];
  customers: EntityOption[];
  suppliers: EntityOption[];
  products: EntityOption[];
  defaultFxRate: number;
  canEdit: boolean;
  onQuickCreateCustomer: (name: string) => Promise<EntityOption>;
  onQuickCreateSupplier: (name: string) => Promise<EntityOption>;
  onQuickCreateProduct: (name: string) => Promise<EntityOption>;
}

export function SamplesClient({
  samples, customers, suppliers, products, defaultFxRate, canEdit,
  onQuickCreateCustomer, onQuickCreateSupplier, onQuickCreateProduct,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SampleWithRelations | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return samples;
    return samples.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.product_name.toLowerCase().includes(q) ||
        (s.customer?.name ?? '').toLowerCase().includes(q),
    );
  }, [samples, query]);

  async function handleApprove(s: SampleWithRelations) {
    const r = await updateSample({ id: s.id, status: 'approved' });
    if (!r.ok) { toast.error(r.error ?? 'Thất bại'); return; }
    toast.success('Đã duyệt mẫu');
    router.refresh();
  }

  async function handleCancel(s: SampleWithRelations) {
    if (!window.confirm(`Huỷ mẫu ${s.code}? Khách sẽ mất cọc ${vnd(s.deposit_paid)}.`)) return;
    const r = await updateSample({ id: s.id, status: 'cancelled' });
    if (!r.ok) { toast.error(r.error ?? 'Thất bại'); return; }
    toast.success('Đã huỷ mẫu');
    router.refresh();
  }

  async function handleRefund(s: SampleWithRelations) {
    const maxR = calcMaxRefund(s.status, s.deposit_amount, s.cumulative_qty_ordered);
    if (maxR === 0) { toast.error('Chưa đủ điều kiện hoàn cọc'); return; }
    const input = window.prompt(
      `Hoàn tối đa: ${vnd(maxR)}\nĐã hoàn trước: ${vnd(s.refund_amount)}\nNhập số tiền hoàn lần này:`,
      String(maxR - s.refund_amount),
    );
    if (input == null) return;
    const amount = Number(input);
    if (!amount || amount <= 0) { toast.error('Số tiền không hợp lệ'); return; }
    const newTotal = s.refund_amount + amount;
    if (newTotal > maxR) { toast.error(`Vượt mức tối đa ${vnd(maxR)}`); return; }
    const r = await updateSample({ id: s.id, refund_amount: newTotal });
    if (!r.ok) { toast.error(r.error ?? 'Thất bại'); return; }
    toast.success(`Đã ghi nhận hoàn ${vnd(amount)}`);
    router.refresh();
  }

  async function handleUpdateQty(s: SampleWithRelations) {
    const input = window.prompt(
      `Cập nhật tổng SL đặt hàng tích lũy cho mẫu ${s.code} (hiện tại: ${s.cumulative_qty_ordered}):`,
      String(s.cumulative_qty_ordered),
    );
    if (input == null) return;
    const qty = Number(input);
    if (isNaN(qty) || qty < 0) { toast.error('Số lượng không hợp lệ'); return; }
    const r = await updateSample({ id: s.id, cumulative_qty_ordered: qty });
    if (!r.ok) { toast.error(r.error ?? 'Thất bại'); return; }
    toast.success('Đã cập nhật số lượng');
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm mã mẫu, sản phẩm, khách hàng..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {canEdit && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Tạo mẫu mới
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
          {query ? 'Không tìm thấy mẫu.' : 'Chưa có mẫu nào.'}
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã mẫu</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Sản phẩm mẫu</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Cọc yêu cầu</TableHead>
                <TableHead className="text-right">Đã cọc</TableHead>
                <TableHead className="text-right">Tổng chi phí</TableHead>
                <TableHead className="text-right">SL tích lũy</TableHead>
                <TableHead className="text-right">Đã hoàn</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const totalCost = s.goods_cost_vnd + s.ship_cost_vnd + s.sample_fee_vnd + s.other_cost_vnd;
                const maxR = calcMaxRefund(s.status, s.deposit_amount, s.cumulative_qty_ordered);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.code}</TableCell>
                    <TableCell>{s.customer?.name ?? '—'}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{s.product_name}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[s.status] ?? 'secondary'}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{vnd(s.deposit_amount)}</TableCell>
                    <TableCell className="text-right">{vnd(s.deposit_paid)}</TableCell>
                    <TableCell className="text-right">{vnd(totalCost)}</TableCell>
                    <TableCell className="text-right">
                      <button
                        className="flex items-center gap-1 ml-auto text-sm hover:underline"
                        onClick={() => canEdit && handleUpdateQty(s)}
                      >
                        {s.cumulative_qty_ordered}
                        {canEdit && <RefreshCw className="h-3 w-3 text-muted-foreground" />}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={maxR > 0 && s.refund_amount < maxR ? 'text-amber-600 font-medium' : ''}>
                        {vnd(s.refund_amount)}
                      </span>
                      {maxR > 0 && s.refund_amount < maxR && (
                        <span className="block text-xs text-muted-foreground">tối đa {vnd(maxR)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canEdit && s.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setEditing(s)}
                          >
                            Sửa
                          </Button>
                        )}
                        {canEdit && s.status === 'pending' && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => handleApprove(s)}>
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleCancel(s)}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {canEdit && s.status === 'approved' && maxR > s.refund_amount && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-green-700"
                            onClick={() => handleRefund(s)}
                          >
                            Hoàn cọc
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo mẫu mới</DialogTitle>
          </DialogHeader>
          <SampleForm
            customers={customers}
            suppliers={suppliers}
            products={products}
            defaultFxRate={defaultFxRate}
            onClose={() => setFormOpen(false)}
            onQuickCreateCustomer={onQuickCreateCustomer}
            onQuickCreateSupplier={onQuickCreateSupplier}
            onQuickCreateProduct={onQuickCreateProduct}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sửa mẫu {editing?.code}</DialogTitle>
          </DialogHeader>
          {editing && (
            <SampleForm
              customers={customers}
              suppliers={suppliers}
              products={products}
              defaultFxRate={defaultFxRate}
              editing={editing}
              onClose={() => setEditing(null)}
              onQuickCreateCustomer={onQuickCreateCustomer}
              onQuickCreateSupplier={onQuickCreateSupplier}
              onQuickCreateProduct={onQuickCreateProduct}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
