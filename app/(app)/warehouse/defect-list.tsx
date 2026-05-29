'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { DefectWithContext, DefectHandlingMethod } from '@/lib/types';
import { resolveDefect } from './defect-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { vnd, formatDate } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const HANDLING_LABELS: Record<DefectHandlingMethod, string> = {
  return_supplier: 'Trả NCC',
  liquidation:     'Thanh lý',
  discount:        'Giảm giá',
  gift:            'Tặng',
  keep:            'Giữ lại',
};

const HANDLING_OPTIONS: { value: DefectHandlingMethod; label: string }[] = [
  { value: 'return_supplier', label: 'Trả về NCC' },
  { value: 'liquidation',     label: 'Thanh lý' },
  { value: 'discount',        label: 'Bán giảm giá' },
  { value: 'gift',            label: 'Tặng khách' },
  { value: 'keep',            label: 'Giữ lại' },
];

interface Props {
  defects: DefectWithContext[];
}

export function DefectList({ defects: initialDefects }: Props) {
  const router = useRouter();
  const [defects, setDefects] = React.useState(initialDefects);
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);
  const [pendingMethod, setPendingMethod] = React.useState<Record<string, DefectHandlingMethod>>({});

  async function handleResolve(defect: DefectWithContext) {
    const method = pendingMethod[defect.id] ?? defect.handling_method;
    setResolvingId(defect.id);
    try {
      const r = await resolveDefect(defect.id, { handling_method: method });
      if (!r.ok) { toast.error(r.error ?? 'Thất bại'); return; }
      setDefects((prev) => prev.map((d) => d.id === defect.id ? { ...d, is_resolved: true, handling_method: method } : d));
      toast.success('Đã đánh dấu xử lý xong');
      router.refresh();
    } finally {
      setResolvingId(null);
    }
  }

  const unresolved = defects.filter((d) => !d.is_resolved);
  const resolved = defects.filter((d) => d.is_resolved);
  const totalLoss = unresolved.reduce((s, d) => s + Number(d.loss_vnd), 0);

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-4 rounded-lg bg-muted/30 px-4 py-2 text-sm">
        <span className="text-muted-foreground">Chưa xử lý:</span>
        <Badge variant="destructive">{unresolved.length}</Badge>
        <span className="text-muted-foreground">Tổn thất ước tính:</span>
        <span className="font-semibold text-destructive">{vnd(totalLoss)}</span>
        <span className="text-muted-foreground ml-auto">Đã xử lý: {resolved.length}</span>
      </div>

      {defects.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Không có hàng lỗi nào.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left">Mã PO</th>
                <th className="px-3 py-2 text-left">Sản phẩm</th>
                <th className="px-3 py-2 text-left">Loại lỗi</th>
                <th className="px-3 py-2 text-right">SL</th>
                <th className="px-3 py-2 text-right">Tổn thất</th>
                <th className="px-3 py-2 text-left">Xử lý</th>
                <th className="px-3 py-2 text-left">Ngày tạo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {defects.map((d) => (
                <tr key={d.id} className={`border-b last:border-0 ${d.is_resolved ? 'opacity-50' : 'hover:bg-muted/20'}`}>
                  <td className="px-3 py-2 font-mono text-xs">{d.po_code}</td>
                  <td className="px-3 py-2">
                    <span>{d.product_name}</span>
                    {(d.variant_color || d.variant_size) && (
                      <div className="flex gap-1 mt-0.5">
                        {d.variant_color && <Badge variant="outline" className="text-[10px]">{d.variant_color}</Badge>}
                        {d.variant_size && <Badge variant="secondary" className="text-[10px]">{d.variant_size}</Badge>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{d.defect_reason}</td>
                  <td className="px-3 py-2 text-right font-medium">{d.quantity}</td>
                  <td className="px-3 py-2 text-right text-destructive">{vnd(d.loss_vnd)}</td>
                  <td className="px-3 py-2">
                    {d.is_resolved ? (
                      <Badge variant="success" className="text-xs">{HANDLING_LABELS[d.handling_method]}</Badge>
                    ) : (
                      <Select
                        value={pendingMethod[d.id] ?? d.handling_method}
                        onValueChange={(v) => setPendingMethod((prev) => ({ ...prev, [d.id]: v as DefectHandlingMethod }))}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HANDLING_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(d.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    {!d.is_resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={resolvingId === d.id}
                        onClick={() => handleResolve(d)}
                      >
                        {resolvingId === d.id ? '...' : 'Xong'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
