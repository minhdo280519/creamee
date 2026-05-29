'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ProductVariant } from '@/lib/types';
import { createVariant, updateVariant } from './variant-actions';
import { VariantImageUploader } from '@/components/variant-image-uploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  editing?: ProductVariant | null;
}

const COMMON_COLORS = [
  'Đen', 'Trắng', 'Xám', 'Be', 'Navy', 'Xanh dương', 'Xanh lá', 'Đỏ',
  'Hồng', 'Tím', 'Nâu', 'Cam', 'Vàng', 'Xanh ngọc',
];
const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Free size'];

export function VariantFormDialog({ open, onOpenChange, productId, editing }: Props) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);

  // Form state
  const [sku, setSku] = React.useState('');
  const [color, setColor] = React.useState('');
  const [size, setSize] = React.useState('');
  const [barcode, setBarcode] = React.useState('');
  const [costCny, setCostCny] = React.useState(0);
  const [costVnd, setCostVnd] = React.useState(0);
  const [priceVnd, setPriceVnd] = React.useState(0);
  const [notes, setNotes] = React.useState('');
  const [imageUrls, setImageUrls] = React.useState<string[]>([]);

  // variantId cho upload: khi tạo mới dùng temp ID, khi edit dùng editing.id
  const [tempId] = React.useState(() => crypto.randomUUID());
  const variantId = editing?.id ?? tempId;

  React.useEffect(() => {
    if (editing) {
      setSku(editing.sku);
      setColor(editing.color ?? '');
      setSize(editing.size ?? '');
      setBarcode(editing.barcode ?? '');
      setCostCny(editing.cost_cny);
      setCostVnd(editing.cost_vnd);
      setPriceVnd(editing.price_vnd);
      setNotes(editing.notes ?? '');
      setImageUrls(editing.image_urls ?? []);
    } else {
      setSku('');
      setColor('');
      setSize('');
      setBarcode('');
      setCostCny(0);
      setCostVnd(0);
      setPriceVnd(0);
      setNotes('');
      setImageUrls([]);
    }
  }, [editing, open]);

  async function handleSave() {
    if (!sku.trim()) { toast.error('SKU bắt buộc'); return; }
    setSaving(true);
    try {
      const vals = {
        sku: sku.trim(),
        color: color.trim() || undefined,
        size: size.trim() || undefined,
        barcode: barcode.trim() || undefined,
        cost_cny: costCny,
        cost_vnd: costVnd,
        price_vnd: priceVnd,
        image_urls: imageUrls,
        notes: notes.trim() || undefined,
      };

      const result = editing
        ? await updateVariant(editing.id, vals)
        : await createVariant(productId, { ...vals, sku: sku.trim() });

      if (!result.ok) { toast.error(result.error ?? 'Lưu thất bại'); return; }
      toast.success(editing ? 'Đã cập nhật variant' : 'Đã tạo variant');
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Sửa variant' : 'Thêm variant mới'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* SKU */}
          <div className="space-y-1.5">
            <Label>SKU *</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="VD: AO-LEN-001-DEN-M" />
          </div>

          {/* Màu sắc */}
          <div className="space-y-1.5">
            <Label>Màu sắc</Label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="VD: Đen" />
            <div className="flex flex-wrap gap-1">
              {COMMON_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`rounded px-2 py-0.5 text-xs border transition-colors ${
                    color === c
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted hover:border-primary'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="space-y-1.5">
            <Label>Size</Label>
            <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="VD: M" />
            <div className="flex flex-wrap gap-1">
              {COMMON_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={`rounded px-2 py-0.5 text-xs border transition-colors ${
                    size === s
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted hover:border-primary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Giá */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Giá vốn (CNY)</Label>
              <Input
                type="number"
                step={0.01}
                value={costCny}
                onChange={(e) => setCostCny(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Giá vốn (VND)</Label>
              <Input
                type="number"
                step={1000}
                value={costVnd}
                onChange={(e) => setCostVnd(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Giá bán sỉ (VND)</Label>
              <Input
                type="number"
                step={1000}
                value={priceVnd}
                onChange={(e) => setPriceVnd(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Barcode */}
          <div className="space-y-1.5">
            <Label>Barcode</Label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Mã vạch (nếu có)" />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ghi chú thêm..." />
          </div>

          {/* Ảnh */}
          <div className="space-y-1.5">
            <Label>Ảnh variant (tối đa 10)</Label>
            <VariantImageUploader
              variantId={variantId}
              existingUrls={imageUrls}
              onChange={setImageUrls}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Huỷ
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Tạo variant'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
