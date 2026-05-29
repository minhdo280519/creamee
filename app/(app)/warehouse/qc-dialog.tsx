'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { saveQCResult, type QCInput } from './defect-actions';
import type { DefectHandlingMethod } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const DEFECT_REASONS = [
  'Lỗi dệt', 'Đứt chỉ', 'Ố bẩn', 'Sai màu', 'Sai size',
  'Hàng bị ẩm/mốc', 'Rách', 'Cúc bị vỡ', 'Khóa kéo hỏng', 'Khác',
];

const HANDLING_OPTIONS: { value: DefectHandlingMethod; label: string }[] = [
  { value: 'return_supplier', label: 'Trả về NCC' },
  { value: 'liquidation',     label: 'Thanh lý' },
  { value: 'discount',        label: 'Bán giảm giá' },
  { value: 'gift',            label: 'Tặng khách' },
  { value: 'keep',            label: 'Giữ lại (dùng được)' },
];

interface DefectDraft {
  _key: string;
  defect_reason: string;
  quantity: number;
  handling_method: DefectHandlingMethod;
  handling_notes: string;
  loss_vnd: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  poId: string;
  poCode: string;
  poItemId: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  variantLabel?: string;
  qtyOrdered: number;
}

export function QCDialog({
  open, onOpenChange,
  poId, poCode, poItemId, productId, variantId,
  productName, variantLabel, qtyOrdered,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [qtyReported, setQtyReported] = React.useState(qtyOrdered);
  const [qtyReceived, setQtyReceived] = React.useState(qtyOrdered);
  const [qtyGood, setQtyGood] = React.useState(qtyOrdered);
  const [qcNotes, setQcNotes] = React.useState('');
  const [defects, setDefects] = React.useState<DefectDraft[]>([]);

  const totalDefectQty = defects.reduce((s, d) => s + d.quantity, 0);
  const autoGood = Math.max(0, qtyReceived - totalDefectQty);

  React.useEffect(() => {
    setQtyReported(qtyOrdered);
    setQtyReceived(qtyOrdered);
    setQtyGood(qtyOrdered);
    setDefects([]);
    setQcNotes('');
  }, [qtyOrdered, open]);

  React.useEffect(() => {
    setQtyGood(autoGood);
  }, [autoGood]);

  function addDefect() {
    setDefects((prev) => [
      ...prev,
      {
        _key: crypto.randomUUID(),
        defect_reason: '',
        quantity: 1,
        handling_method: 'return_supplier',
        handling_notes: '',
        loss_vnd: 0,
      },
    ]);
  }

  function removeDefect(key: string) {
    setDefects((prev) => prev.filter((d) => d._key !== key));
  }

  function updateDefect(key: string, patch: Partial<DefectDraft>) {
    setDefects((prev) => prev.map((d) => d._key === key ? { ...d, ...patch } : d));
  }

  async function handleSave() {
    if (qtyReceived < 0 || qtyGood < 0) {
      toast.error('Số lượng không hợp lệ');
      return;
    }
    const validDefects = defects.filter((d) => d.defect_reason && d.quantity > 0);

    setSaving(true);
    try {
      const input: QCInput = {
        po_item_id: poItemId,
        po_id: poId,
        product_id: productId,
        variant_id: variantId,
        qty_reported: qtyReported,
        qty_actual_received: qtyReceived,
        qty_good: qtyGood,
        qc_notes: qcNotes,
        defects: validDefects.map((d) => ({
          defect_reason: d.defect_reason,
          quantity: d.quantity,
          handling_method: d.handling_method,
          handling_notes: d.handling_notes,
          loss_vnd: d.loss_vnd,
        })),
      };

      const r = await saveQCResult(input);
      if (!r.ok) { toast.error(r.error ?? 'Lưu QC thất bại'); return; }
      toast.success(`QC xong: ${qtyGood} cái tốt` + (validDefects.length ? `, ${totalDefectQty} cái lỗi` : ''));
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const label = variantLabel ? `${productName} — ${variantLabel}` : productName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>QC Nhập kho — {poCode}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sản phẩm */}
          <div className="rounded-lg bg-muted/30 px-3 py-2 text-sm font-medium">{label}</div>

          {/* 3 con số QC */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>NCC báo</Label>
              <Input type="number" min={0} value={qtyReported}
                onChange={(e) => setQtyReported(Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="space-y-1.5">
              <Label>Thực nhận</Label>
              <Input type="number" min={0} value={qtyReceived}
                onChange={(e) => setQtyReceived(Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="space-y-1.5">
              <Label>Good sau QC</Label>
              <div className="relative">
                <Input
                  type="number" min={0}
                  value={qtyGood}
                  onChange={(e) => setQtyGood(Math.max(0, Number(e.target.value)))}
                  className={qtyGood < qtyReceived ? 'border-amber-400' : ''}
                />
                {qtyGood < qtyReceived && (
                  <Badge variant="warning" className="absolute -top-2 -right-2 text-[9px] px-1">
                    -{qtyReceived - qtyGood}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Ghi chú QC */}
          <div className="space-y-1.5">
            <Label>Ghi chú QC</Label>
            <Input value={qcNotes} onChange={(e) => setQcNotes(e.target.value)}
              placeholder="Ghi chú kết quả kiểm hàng..." />
          </div>

          {/* Defects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Hàng lỗi ({totalDefectQty} cái)</Label>
              <Button size="sm" variant="outline" onClick={addDefect}>
                <Plus className="h-3.5 w-3.5" />
                Thêm lỗi
              </Button>
            </div>

            {defects.length === 0 ? (
              <p className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
                Không có hàng lỗi — nhấn "Thêm lỗi" nếu có
              </p>
            ) : (
              <div className="space-y-2">
                {defects.map((d) => (
                  <div key={d._key} className="rounded-lg border p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Loại lỗi</Label>
                        <Select value={d.defect_reason}
                          onValueChange={(v) => updateDefect(d._key, { defect_reason: v })}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Chọn lỗi..." />
                          </SelectTrigger>
                          <SelectContent>
                            {DEFECT_REASONS.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">SL lỗi</Label>
                        <Input type="number" min={1} value={d.quantity} className="h-8 text-xs"
                          onChange={(e) => updateDefect(d._key, { quantity: Math.max(1, Number(e.target.value)) })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Xử lý</Label>
                        <Select value={d.handling_method}
                          onValueChange={(v) => updateDefect(d._key, { handling_method: v as DefectHandlingMethod })}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {HANDLING_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tổn thất (VND)</Label>
                        <Input type="number" step={10000} value={d.loss_vnd} className="h-8 text-xs"
                          onChange={(e) => updateDefect(d._key, { loss_vnd: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input value={d.handling_notes} className="h-7 text-xs flex-1"
                        placeholder="Ghi chú xử lý..."
                        onChange={(e) => updateDefect(d._key, { handling_notes: e.target.value })} />
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => removeDefect(d._key)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">NCC báo</span>
              <span>{qtyReported}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Thực nhận</span>
              <span className={qtyReceived < qtyReported ? 'text-amber-600 font-medium' : ''}>{qtyReceived}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lỗi</span>
              <span className={totalDefectQty > 0 ? 'text-destructive font-medium' : ''}>{totalDefectQty}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Nhập kho</span>
              <span className="text-emerald-600">{qtyGood}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Xác nhận QC'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
