'use client';

import * as React from 'react';
import { Loader2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { getProductHistory, type ProductMovement } from './actions';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Props {
  productId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ProductHistoryDialog({ productId, open, onOpenChange }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [productName, setProductName] = React.useState('');
  const [movements, setMovements] = React.useState<ProductMovement[]>([]);

  React.useEffect(() => {
    if (!open || !productId) { setMovements([]); return; }
    setLoading(true);
    getProductHistory(productId).then((r) => {
      if (r.ok) {
        setProductName(r.productName ?? '');
        setMovements(r.movements ?? []);
      } else {
        toast.error(r.error ?? 'Không tải được lịch sử');
      }
      setLoading(false);
    });
  }, [open, productId]);

  // Tính tồn lũy kế
  let runningQty = 0;
  const withBalance = movements.map((m) => {
    runningQty = m.type === 'in' ? runningQty + m.qty : runningQty - m.qty;
    return { ...m, balance: runningQty };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lịch sử nhập/xuất — {productName}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && movements.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Chưa có lịch sử nhập/xuất.</p>
        )}

        {!loading && withBalance.length > 0 && (
          <div className="relative pl-6">
            {/* Đường timeline */}
            <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-3">
              {withBalance.map((m, i) => (
                <div key={i} className="relative flex gap-3">
                  {/* Dot */}
                  <div className={`absolute -left-4 mt-1 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background
                    ${m.type === 'in' ? 'border-emerald-500' : 'border-blue-500'}`}
                  >
                    {m.type === 'in'
                      ? <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600" />
                      : <ArrowUpCircle className="h-3.5 w-3.5 text-blue-600" />}
                  </div>

                  <div className="flex-1 rounded-lg border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={m.type === 'in' ? 'success' : 'default'} className="text-xs">
                          {m.type === 'in' ? '+ Nhập' : '− Xuất'}
                        </Badge>
                        <span className="font-semibold">
                          {m.type === 'in' ? '+' : '−'}{m.qty} cái
                        </span>
                        {m.ref_code && (
                          <span className="text-xs text-primary font-medium">{m.ref_type}: {m.ref_code}</span>
                        )}
                        {m.lot_code && (
                          <span className="text-xs text-muted-foreground">Lô: {m.lot_code}</span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">{formatDate(m.date)}</div>
                        <div className="text-xs font-medium">Tồn: <span className={m.balance < 0 ? 'text-destructive' : ''}>{m.balance}</span></div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.note}</div>
                  </div>
                </div>
              ))}

              {/* Current balance */}
              <div className="relative flex gap-3">
                <div className="absolute -left-4 mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <span className="text-[10px] text-primary-foreground font-bold">TK</span>
                </div>
                <div className="flex-1 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm font-semibold">
                  Tồn hiện tại: {runningQty} cái
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
