'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { vnd, cny } from '@/lib/utils';
import { createSample, updateSample } from './actions';
import { calcMaxRefund } from '@/lib/sample-business';
import type { SampleWithRelations } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EntityCombobox, type EntityOption } from '@/components/entity-combobox';

interface Props {
  customers: EntityOption[];
  suppliers: EntityOption[];
  products: EntityOption[];
  defaultFxRate: number;
  editing?: SampleWithRelations;
  onClose: () => void;
  onQuickCreateCustomer: (name: string) => Promise<EntityOption>;
}

const DEFAULT_DEPOSIT = 3_500_000;

export function SampleForm({
  customers, suppliers, products, defaultFxRate,
  editing, onClose, onQuickCreateCustomer,
}: Props) {
  const router = useRouter();
  const isEdit = !!editing;

  const [customerId, setCustomerId] = React.useState<string | null>(editing?.customer_id ?? null);
  const [productId, setProductId] = React.useState(editing?.product_id ?? '');
  const [productName, setProductName] = React.useState(editing?.product_name ?? '');
  const [supplierId, setSupplierId] = React.useState(editing?.supplier_id ?? '');
  const [depositAmount, setDepositAmount] = React.useState(editing?.deposit_amount ?? DEFAULT_DEPOSIT);
  const [depositPaid, setDepositPaid] = React.useState(editing?.deposit_paid ?? 0);
  const [goodsCostCny, setGoodsCostCny] = React.useState(editing?.goods_cost_cny ?? 0);
  const [goodsCostVnd, setGoodsCostVnd] = React.useState(editing?.goods_cost_vnd ?? 0);
  const [shipCostVnd, setShipCostVnd] = React.useState(editing?.ship_cost_vnd ?? 0);
  const [sampleFeeVnd, setSampleFeeVnd] = React.useState(editing?.sample_fee_vnd ?? 0);
  const [otherCostVnd, setOtherCostVnd] = React.useState(editing?.other_cost_vnd ?? 0);
  const [fxRate, setFxRate] = React.useState(editing?.fx_rate ?? defaultFxRate);
  const [notes, setNotes] = React.useState(editing?.notes ?? '');
  const [saving, setSaving] = React.useState(false);

  function pickProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) setProductName(p.label);
  }

  const totalCostVnd = goodsCostVnd + shipCostVnd + sampleFeeVnd + otherCostVnd;
  const maxRefund = isEdit
    ? calcMaxRefund(editing!.status, depositAmount, editing!.cumulative_qty_ordered)
    : 0;

  async function handleSave() {
    if (!customerId) { toast.error('Vui lòng chọn khách hàng'); return; }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (!productName.trim()) { toast.error('Vui lòng nhập tên sản phẩm mẫu'); return; }

    setSaving(true);
    try {
      if (isEdit) {
        const r = await updateSample({
          id: editing!.id,
          product_name: productName,
          supplier_id: supplierId,
          deposit_paid: depositPaid,
          goods_cost_cny: goodsCostCny,
          goods_cost_vnd: goodsCostVnd,
          ship_cost_vnd: shipCostVnd,
          sample_fee_vnd: sampleFeeVnd,
          other_cost_vnd: otherCostVnd,
          fx_rate: fxRate,
          notes,
        });
        if (!r.ok) { toast.error(r.error ?? 'Cập nhật thất bại'); return; }
        toast.success('Đã cập nhật mẫu');
      } else {
        const r = await createSample({
          customer_id: customerId!,
          product_id: productId || undefined,
          product_name: productName,
          supplier_id: supplierId || undefined,
          deposit_amount: depositAmount,
          deposit_paid: depositPaid,
          goods_cost_cny: goodsCostCny,
          goods_cost_vnd: goodsCostVnd,
          ship_cost_vnd: shipCostVnd,
          sample_fee_vnd: sampleFeeVnd,
          other_cost_vnd: otherCostVnd,
          fx_rate: fxRate,
          notes,
        });
        if (!r.ok) { toast.error(r.error ?? 'Tạo mẫu thất bại'); return; }
        toast.success(`Đã tạo mẫu ${r.data?.code}`);
      }
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Khách hàng */}
        <div className="space-y-1.5">
          <Label>Khách hàng <span className="text-destructive">*</span></Label>
          {isEdit ? (
            <Input value={editing!.customer?.name ?? ''} readOnly className="bg-muted" />
          ) : (
            <EntityCombobox
              options={customers}
              value={customerId}
              onChange={setCustomerId}
              entityLabel="khách hàng"
              placeholder="Chọn khách hàng"
              onCreate={onQuickCreateCustomer}
            />
          )}
        </div>

        {/* Nhà cung cấp */}
        <div className="space-y-1.5">
          <Label>Nhà cung cấp</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn NCC (tuỳ chọn)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— Chưa có NCC —</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sản phẩm mẫu */}
        <div className="space-y-1.5">
          <Label>Sản phẩm trong hệ thống (tuỳ chọn)</Label>
          <Select value={productId} onValueChange={pickProduct}>
            <SelectTrigger>
              <SelectValue placeholder="Gắn với sản phẩm có sẵn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— Không gắn —</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tên sản phẩm mẫu */}
        <div className="space-y-1.5">
          <Label>Tên / mô tả sản phẩm mẫu <span className="text-destructive">*</span></Label>
          <Input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="VD: Áo hoodie oversize màu xanh navy"
          />
        </div>
      </div>

      {/* Chi phí nhà cung cấp */}
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-semibold">Chi phí trả nhà cung cấp</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Tỷ giá CNY→VND</Label>
            <Input
              type="number"
              value={fxRate}
              onChange={(e) => setFxRate(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Giá vốn hàng (¥)</Label>
            <Input
              type="number"
              step={0.5}
              value={goodsCostCny}
              onChange={(e) => {
                const v = Math.max(0, Number(e.target.value));
                setGoodsCostCny(v);
                setGoodsCostVnd(Math.round(v * fxRate));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Giá vốn hàng (VND)</Label>
            <Input
              type="number"
              step={1000}
              value={goodsCostVnd}
              onChange={(e) => setGoodsCostVnd(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phí ship NCC (VND)</Label>
            <Input
              type="number"
              step={1000}
              value={shipCostVnd}
              onChange={(e) => setShipCostVnd(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phí làm mẫu (VND)</Label>
            <Input
              type="number"
              step={1000}
              value={sampleFeeVnd}
              onChange={(e) => setSampleFeeVnd(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Chi phí khác (VND)</Label>
            <Input
              type="number"
              step={1000}
              value={otherCostVnd}
              onChange={(e) => setOtherCostVnd(Math.max(0, Number(e.target.value)))}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Tổng chi phí:</span>
          <span className="font-semibold">{vnd(totalCostVnd)}</span>
          {goodsCostCny > 0 && (
            <span className="text-muted-foreground">({cny(goodsCostCny)} giá vốn CNY)</span>
          )}
        </div>
      </div>

      {/* Tiền cọc */}
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-semibold">Tiền cọc khách hàng</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Số tiền cọc yêu cầu (VND)</Label>
            <Input
              type="number"
              step={100000}
              value={depositAmount}
              onChange={(e) => setDepositAmount(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Đã nhận cọc (VND)</Label>
            <Input
              type="number"
              step={100000}
              value={depositPaid}
              onChange={(e) => setDepositPaid(Math.max(0, Number(e.target.value)))}
            />
          </div>
          {isEdit && (
            <Card className="border-0 bg-muted/50">
              <CardContent className="p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SL đặt tích lũy</span>
                  <span className="font-medium">{editing!.cumulative_qty_ordered} cái</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hoàn tối đa</span>
                  <span className="font-semibold text-green-700">{vnd(maxRefund)}</span>
                </div>
                {editing!.refund_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Đã hoàn</span>
                    <span>{vnd(editing!.refund_amount)}</span>
                  </div>
                )}
                <div className="pt-1">
                  {editing!.cumulative_qty_ordered < 200 && editing!.status === 'approved' && (
                    <Badge variant="secondary" className="text-xs">Chưa đủ 200 cái</Badge>
                  )}
                  {editing!.cumulative_qty_ordered >= 200 && editing!.cumulative_qty_ordered < 500 && (
                    <Badge variant="warning" className="text-xs">Hoàn 1M (≥200 cái)</Badge>
                  )}
                  {editing!.cumulative_qty_ordered >= 500 && (
                    <Badge variant="success" className="text-xs">Hoàn full (≥500 cái)</Badge>
                  )}
                  {editing!.status === 'cancelled' && (
                    <Badge variant="destructive" className="text-xs">Mất cọc (đã huỷ)</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Ghi chú</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? 'Lưu thay đổi' : 'Tạo mẫu'}
        </Button>
      </div>
    </div>
  );
}
