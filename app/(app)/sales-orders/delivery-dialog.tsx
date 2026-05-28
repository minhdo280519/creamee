'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getSOItemsForDelivery, markDelivered,
  type SODeliveryItem,
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

export function DeliveryDialog({ orderId, orderCode, open, onOpenChange }: Props) {
  const router = useRouter();
  const [items, setItems] = React.useState<SODeliveryItem[]>([]);
  const [qtys, setQtys] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !orderId) return;
    setLoading(true);
    getSOItemsForDelivery(orderId)
      .then((r) => {
        if (!r.ok || !r.items) {
          toast.error(r.error ?? 'Không lấy được danh sách hàng');
          onOpenChange(false);
          return;
        }
        setItems(r.items);
        const init: Record<string, number> = {};
        for (const it of r.items) {
          init[it.item_id] = Math.max(0, it.quantity - it.delivered_qty);
        }
        setQtys(init);
      })
      .finally(() => setLoading(false));
  }, [open, orderId, onOpenChange]);

  async function handleConfirm() {
    if (!orderId) return;

    for (const it of items) {
      const qty = qtys[it.item_id] ?? 0;
      const remaining = it.quantity - it.delivered_qty;
      if (qty > remaining) {
        toast.error(`${it.product_name}: giao ${qty} vượt quá còn lại ${remaining}`);
        return;
      }
    }

    const lines = items.map((it) => ({ item_id: it.item_id, qty_now: qtys[it.item_id] ?? 0 }));

    setSaving(true);
    try {
      const r = await markDelivered(orderId, lines);
      if (!r.ok) { toast.error(r.error ?? 'Giao hàng thất bại'); return; }
      toast.success(`Đã cập nhật giao hàng đơn ${orderCode}`);
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

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
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-right">SL đặt</TableHead>
                  <TableHead className="text-right">Đã giao</TableHead>
                  <TableHead className="text-right">Còn lại</TableHead>
                  <TableHead className="w-32">Giao lần này</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const remaining = it.quantity - it.delivered_qty;
                  return (
                    <TableRow key={it.item_id}>
                      <TableCell>{it.product_name}</TableCell>
                      <TableCell className="text-right">{it.quantity}</TableCell>
                      <TableCell className="text-right">{it.delivered_qty}</TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        {remaining}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={remaining}
                          value={qtys[it.item_id] ?? 0}
                          disabled={remaining <= 0}
                          onChange={(e) =>
                            setQtys((prev) => ({
                              ...prev,
                              [it.item_id]: Math.max(0, Number(e.target.value)),
                            }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
              <Button onClick={handleConfirm} disabled={saving}>
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
