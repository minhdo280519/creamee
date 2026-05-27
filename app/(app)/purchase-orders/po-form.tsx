'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { vnd, cny } from '@/lib/utils';
import { createPurchaseOrder } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EntityCombobox, type EntityOption } from '@/components/entity-combobox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface ProductOption {
  id: string;
  label: string;
}

interface Props {
  suppliers: EntityOption[];
  products: ProductOption[];
  /** Tỷ giá CNY→VND mặc định từ app_settings. */
  defaultFxRate: number;
  onQuickCreateSupplier: (name: string) => Promise<EntityOption>;
  onClose: () => void;
}

interface DraftLine {
  _key: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost_cny: number;
}

export function POForm({
  suppliers, products, defaultFxRate, onQuickCreateSupplier, onClose,
}: Props) {
  const router = useRouter();
  const [supplierId, setSupplierId] = React.useState<string | null>(null);
  const [orderDate, setOrderDate] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [arrivalDate, setArrivalDate] = React.useState('');
  const [fxRate, setFxRate] = React.useState(defaultFxRate);
  const [shippingCny, setShippingCny] = React.useState(0);
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const [lines, setLines] = React.useState<DraftLine[]>([
    { _key: crypto.randomUUID(), product_id: '', product_name: '', quantity: 1, unit_cost_cny: 0 },
  ]);

  function addLine() {
    setLines((p) => [
      ...p,
      { _key: crypto.randomUUID(), product_id: '', product_name: '', quantity: 1, unit_cost_cny: 0 },
    ]);
  }
  function removeLine(key: string) {
    setLines((p) => (p.length > 1 ? p.filter((l) => l._key !== key) : p));
  }
  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((p) => p.map((l) => (l._key === key ? { ...l, ...patch } : l)));
  }
  function pickProduct(key: string, id: string) {
    const p = products.find((x) => x.id === id);
    if (p) updateLine(key, { product_id: id, product_name: p.label });
  }

  // Tổng tiền realtime.
  const subtotalCny = lines.reduce(
    (s, l) => s + l.quantity * l.unit_cost_cny,
    0,
  );
  const totalCny = subtotalCny + shippingCny;
  const totalVnd = Math.round(totalCny * fxRate);

  async function handleSave() {
    if (!supplierId) {
      toast.error('Vui lòng chọn nhà cung cấp');
      return;
    }
    const valid = lines.filter((l) => l.product_id && l.quantity > 0);
    if (valid.length === 0) {
      toast.error('PO cần ít nhất 1 sản phẩm hợp lệ');
      return;
    }
    setSaving(true);
    try {
      const r = await createPurchaseOrder({
        supplier_id: supplierId,
        order_date: orderDate,
        expected_arrival_date: arrivalDate || undefined,
        fx_rate: fxRate,
        shipping_cny: shippingCny,
        notes,
        items: valid.map((l) => ({
          product_id: l.product_id,
          product_name: l.product_name,
          quantity: l.quantity,
          unit_cost_cny: l.unit_cost_cny,
        })),
      });
      if (!r.ok) {
        toast.error(r.error ?? 'Tạo PO thất bại');
        return;
      }
      toast.success(`Đã tạo đơn nhập ${r.data?.code}`);
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nhà cung cấp <span className="text-destructive">*</span></Label>
          <EntityCombobox
            options={suppliers}
            value={supplierId}
            onChange={setSupplierId}
            entityLabel="nhà cung cấp"
            placeholder="Chọn hoặc tạo NCC"
            onCreate={onQuickCreateSupplier}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="po_date">Ngày đặt</Label>
          <Input
            id="po_date"
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="arrival">Dự kiến về kho</Label>
          <Input
            id="arrival"
            type="date"
            value={arrivalDate}
            onChange={(e) => setArrivalDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fx">Tỷ giá CNY → VND</Label>
          <Input
            id="fx"
            type="number"
            step={1}
            value={fxRate}
            onChange={(e) => setFxRate(Math.max(0, Number(e.target.value)))}
          />
        </div>
      </div>

      {/* Bảng sản phẩm */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Sản phẩm nhập</Label>
          <Button type="button" size="sm" variant="outline" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" />
            Thêm dòng
          </Button>
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Sản phẩm</TableHead>
                <TableHead className="w-24">SL</TableHead>
                <TableHead className="w-36">Giá nhập (¥)</TableHead>
                <TableHead className="w-36 text-right">Thành tiền (¥)</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line._key}>
                  <TableCell>
                    <Select
                      value={line.product_id}
                      onValueChange={(v) => pickProduct(line._key, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn sản phẩm" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line._key, {
                          quantity: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step={0.1}
                      value={line.unit_cost_cny}
                      onChange={(e) =>
                        updateLine(line._key, {
                          unit_cost_cny: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {cny(line.quantity * line.unit_cost_cny)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(line._key)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="shipping">Phí vận chuyển (¥)</Label>
            <Input
              id="shipping"
              type="number"
              step={1}
              value={shippingCny}
              onChange={(e) => setShippingCny(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po_notes">Ghi chú</Label>
            <Textarea
              id="po_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tiền hàng</span>
              <span>{cny(subtotalCny)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phí vận chuyển</span>
              <span>+ {cny(shippingCny)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Tổng (¥)</span>
              <span>{cny(totalCny)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-primary">
              <span>Quy đổi VND</span>
              <span>{vnd(totalVnd)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Huỷ
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Tạo đơn nhập
        </Button>
      </div>
    </div>
  );
}
