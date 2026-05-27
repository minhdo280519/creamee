'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, AlertTriangle, Pencil, Check, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { vnd } from '@/lib/utils';
import {
  getFifoSuggestion, deliverOrder,
  type ItemAllocation,
} from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface Props {
  orderId: string | null;
  orderCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog giao hàng. Mặc định hiển thị GỌN — mỗi sản phẩm 1 dòng tóm tắt
 * (FIFO tự động). Bấm "Chỉnh lô" mới bung bảng chi tiết để sửa — đúng
 * tinh thần "FIFO tự động, chỉ sửa khi cần".
 */
export function DeliveryDialog({
  orderId, orderCode, open, onOpenChange,
}: Props) {
  const router = useRouter();
  const [items, setItems] = React.useState<ItemAllocation[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  // Index sản phẩm đang ở chế độ chỉnh lô.
  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open || !orderId) return;
    setEditingIdx(null);
    setLoading(true);
    getFifoSuggestion(orderId)
      .then((r) => {
        if (!r.ok || !r.items) {
          toast.error(r.error ?? 'Không lấy được gợi ý phân bổ');
          onOpenChange(false);
          return;
        }
        setItems(r.items);
      })
      .finally(() => setLoading(false));
  }, [open, orderId, onOpenChange]);

  function updateLineQty(itemIdx: number, lineIdx: number, qty: number) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === itemIdx
          ? {
              ...it,
              lines: it.lines.map((l, j) =>
                j === lineIdx ? { ...l, qty: Math.max(0, qty) } : l,
              ),
            }
          : it,
      ),
    );
  }

  function removeLine(itemIdx: number, lineIdx: number) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === itemIdx
          ? { ...it, lines: it.lines.filter((_, j) => j !== lineIdx) }
          : it,
      ),
    );
  }

  async function handleDeliver() {
    if (!orderId) return;
    for (const it of items) {
      const allocated = it.lines.reduce((s, l) => s + l.qty, 0);
      if (allocated !== it.quantity) {
        toast.error(
          `${it.product_name}: phân bổ ${allocated} ≠ số lượng ${it.quantity}`,
        );
        return;
      }
    }
    setSaving(true);
    try {
      const r = await deliverOrder(orderId, items);
      if (!r.ok) {
        toast.error(r.error ?? 'Giao hàng thất bại');
        return;
      }
      toast.success(`Đã giao đơn ${orderCode} — kho đã trừ theo lô`);
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const hasNegative = items.some((it) =>
    it.lines.some((l) => l.is_negative && l.qty > 0),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Giao hàng — đơn {orderCode}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Hàng được phân bổ tự động theo FIFO. Chỉ cần chỉnh lô khi thật
              sự cần — bấm <Pencil className="inline h-3 w-3" /> ở dòng tương ứng.
            </p>

            {hasNegative && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Đơn có sản phẩm bán vượt tồn. Phần âm tạm tính giá vốn 0 —
                  hệ thống tự điền lại khi có lô hàng mới về.
                </span>
              </div>
            )}

            {items.map((it, itemIdx) => {
              const editing = editingIdx === itemIdx;
              const allocated = it.lines.reduce((s, l) => s + l.qty, 0);
              const mismatch = allocated !== it.quantity;
              const itemNegative = it.lines.some(
                (l) => l.is_negative && l.qty > 0,
              );
              // Giá vốn tổng dự kiến của dòng.
              const lineCost = it.lines.reduce(
                (s, l) =>
                  s + l.qty * (l.goods_unit_cost + l.ship_unit_cost),
                0,
              );

              return (
                <div key={it.order_item_id} className="rounded-lg border">
                  {/* Dòng tóm tắt — luôn hiện */}
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {it.product_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {it.quantity} sản phẩm
                        {' · '}
                        {it.lines.filter((l) => l.qty > 0).length} lô
                        {itemNegative && (
                          <span className="text-amber-600">
                            {' · có bán âm'}
                          </span>
                        )}
                        {' · giá vốn ~'}
                        {vnd(lineCost)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={editing ? 'default' : 'outline'}
                      onClick={() =>
                        setEditingIdx(editing ? null : itemIdx)
                      }
                    >
                      {editing ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Xong
                        </>
                      ) : (
                        <>
                          <Pencil className="h-3.5 w-3.5" />
                          Chỉnh lô
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Bảng chi tiết — chỉ hiện khi bấm chỉnh */}
                  {editing && (
                    <div className="border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Lô</TableHead>
                            <TableHead className="w-28">Số lượng</TableHead>
                            <TableHead className="text-right">
                              Giá vốn/cái
                            </TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {it.lines.map((line, lineIdx) => (
                            <TableRow key={lineIdx}>
                              <TableCell
                                className={
                                  line.is_negative
                                    ? 'text-amber-600'
                                    : ''
                                }
                              >
                                {line.lot_code}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  value={line.qty}
                                  onChange={(e) =>
                                    updateLineQty(
                                      itemIdx,
                                      lineIdx,
                                      Number(e.target.value),
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                {line.is_negative
                                  ? '— (bù sau)'
                                  : vnd(
                                      line.goods_unit_cost +
                                        line.ship_unit_cost,
                                    )}
                              </TableCell>
                              <TableCell>
                                {it.lines.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      removeLine(itemIdx, lineIdx)
                                    }
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {mismatch && (
                        <p className="px-3 py-2 text-xs text-destructive">
                          Tổng phân bổ {allocated} chưa khớp số lượng đơn{' '}
                          {it.quantity}.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button onClick={handleDeliver} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Xác nhận giao hàng
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
