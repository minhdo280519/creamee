'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { vnd } from '@/lib/utils';
import {
  allocateLegCost, LEG_LABEL, LEG_HINT,
  type ShipmentLeg, type ChargeMode,
} from '@/lib/landed-cost';
import { createShipmentLeg } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface CarrierOption {
  id: string;
  name: string;
  rate_cny_per_kg: number;
}

/** Một dòng PO có thể đưa vào chặng. */
export interface POItemOption {
  po_item_id: string;
  po_id: string;
  po_code: string;
  supplier_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  /** Giá trị hàng dòng này quy ra VND (để tính landed preview). */
  goods_cost_vnd: number;
}

interface Props {
  carriers: CarrierOption[];
  poItems: POItemOption[];
  defaultFxRate: number;
  onClose: () => void;
}

interface DraftItem {
  _key: string;
  po_item_id: string;
  weight_kg: number;
}

export function LegForm({ carriers, poItems, defaultFxRate, onClose }: Props) {
  const router = useRouter();

  const [leg, setLeg] = React.useState<ShipmentLeg>('cn_to_vn');
  const [carrierId, setCarrierId] = React.useState('');
  const [payer, setPayer] =
    React.useState<'ncc_advance' | 'we_pay_now' | 'we_arrange'>('we_pay_now');
  const [chargeMode, setChargeMode] = React.useState<ChargeMode>('per_kg');
  const [ratePerKg, setRatePerKg] = React.useState(0);
  const [flatCost, setFlatCost] = React.useState(0);
  const [fxRate, setFxRate] = React.useState(defaultFxRate);
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const [items, setItems] = React.useState<DraftItem[]>([
    { _key: crypto.randomUUID(), po_item_id: '', weight_kg: 0 },
  ]);

  // Chặng nội địa VN mặc định tính VND trọn gói; chặng TQ tính CNY/kg.
  const currency = leg === 'vn_domestic' ? 'VND' : 'CNY';
  // Nếu currency là VND thì tỷ giá = 1.
  const effectiveFx = currency === 'VND' ? 1 : fxRate;

  function addItem() {
    setItems((p) => [
      ...p,
      { _key: crypto.randomUUID(), po_item_id: '', weight_kg: 0 },
    ]);
  }
  function removeItem(key: string) {
    setItems((p) => (p.length > 1 ? p.filter((i) => i._key !== key) : p));
  }
  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((p) => p.map((i) => (i._key === key ? { ...i, ...patch } : i)));
  }

  // Khi đổi loại chặng → gợi ý đơn giá carrier (chỉ chặng TQ→VN).
  function pickCarrier(id: string) {
    setCarrierId(id);
    const c = carriers.find((x) => x.id === id);
    if (c && chargeMode === 'per_kg') setRatePerKg(c.rate_cny_per_kg);
  }

  // Preview phân bổ — dùng cùng công thức với trigger 0008.
  const preview = React.useMemo(() => {
    const lines = items
      .map((it) => {
        const po = poItems.find((p) => p.po_item_id === it.po_item_id);
        if (!po) return null;
        return {
          key: it._key,
          productName: po.product_name,
          quantity: po.quantity,
          weightKg: it.weight_kg,
          goodsCostVnd: po.goods_cost_vnd,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return allocateLegCost(lines, {
      chargeMode,
      ratePerKg,
      flatCost,
      fxRate: effectiveFx,
    });
  }, [items, poItems, chargeMode, ratePerKg, flatCost, effectiveFx]);

  async function handleSave() {
    const valid = items
      .map((it) => {
        const po = poItems.find((p) => p.po_item_id === it.po_item_id);
        if (!po || it.weight_kg <= 0) return null;
        return {
          po_id: po.po_id,
          po_item_id: po.po_item_id,
          product_id: po.product_id,
          product_name: po.product_name,
          quantity: po.quantity,
          weight_kg: it.weight_kg,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (valid.length === 0) {
      toast.error('Cần ít nhất 1 dòng hàng hợp lệ (có chọn PO + trọng lượng)');
      return;
    }

    setSaving(true);
    try {
      const r = await createShipmentLeg({
        leg,
        carrier_id: carrierId || undefined,
        payer,
        charge_mode: chargeMode,
        rate_per_kg_cny: ratePerKg,
        flat_cost: flatCost,
        currency,
        fx_rate: effectiveFx,
        notes,
        items: valid,
      });
      if (!r.ok) {
        toast.error(r.error ?? 'Tạo chặng thất bại');
        return;
      }
      toast.success(`Đã tạo chặng ${r.data?.code} — chi phí đã phân bổ`);
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Loại chặng + đơn vị VC */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Loại chặng *</Label>
          <Select value={leg} onValueChange={(v) => setLeg(v as ShipmentLeg)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cn_domestic">{LEG_LABEL.cn_domestic}</SelectItem>
              <SelectItem value="cn_to_vn">{LEG_LABEL.cn_to_vn}</SelectItem>
              <SelectItem value="vn_domestic">{LEG_LABEL.vn_domestic}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{LEG_HINT[leg]}</p>
        </div>
        <div className="space-y-1.5">
          <Label>Đơn vị vận chuyển</Label>
          <Select value={carrierId} onValueChange={pickCarrier}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn carrier (tuỳ chọn)" />
            </SelectTrigger>
            <SelectContent>
              {carriers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} · {c.rate_cny_per_kg}¥/kg
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ai trả chi phí</Label>
          <Select
            value={payer}
            onValueChange={(v) =>
              setPayer(v as 'ncc_advance' | 'we_pay_now' | 'we_arrange')
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ncc_advance">NCC ứng trước</SelectItem>
              <SelectItem value="we_pay_now">Mình trả ngay</SelectItem>
              <SelectItem value="we_arrange">Mình tự thuê</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cách tính chi phí */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Cách tính phí</Label>
          <Select
            value={chargeMode}
            onValueChange={(v) => setChargeMode(v as ChargeMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per_kg">Theo kg × đơn giá</SelectItem>
              <SelectItem value="flat">Trọn gói cả chuyến</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {chargeMode === 'per_kg' ? (
          <div className="space-y-1.5">
            <Label>Đơn giá ({currency}/kg)</Label>
            <Input
              type="number"
              step={0.1}
              value={ratePerKg}
              onChange={(e) => setRatePerKg(Math.max(0, Number(e.target.value)))}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Phí trọn gói ({currency})</Label>
            <Input
              type="number"
              step={1000}
              value={flatCost}
              onChange={(e) => setFlatCost(Math.max(0, Number(e.target.value)))}
            />
          </div>
        )}
        {currency === 'CNY' ? (
          <div className="space-y-1.5">
            <Label>Tỷ giá CNY → VND</Label>
            <Input
              type="number"
              value={fxRate}
              onChange={(e) => setFxRate(Math.max(0, Number(e.target.value)))}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Tiền tệ</Label>
            <Input value="VND (nội địa, không quy đổi)" readOnly />
          </div>
        )}
      </div>

      {/* Các dòng hàng — chọn dòng PO, nhập kg */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>
            Hàng trong chặng — chọn dòng đơn mua (có thể gộp nhiều PO)
          </Label>
          <Button type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-3.5 w-3.5" />
            Thêm dòng
          </Button>
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[280px]">
                  Dòng đơn mua (PO · sản phẩm)
                </TableHead>
                <TableHead className="w-20">SL</TableHead>
                <TableHead className="w-28">KG thực</TableHead>
                <TableHead className="w-32 text-right">Ship/cái</TableHead>
                <TableHead className="w-36 text-right">Landed/cái</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const po = poItems.find(
                  (p) => p.po_item_id === item.po_item_id,
                );
                const pv = preview.lines.find((l) => l.key === item._key);
                return (
                  <TableRow key={item._key}>
                    <TableCell>
                      <Select
                        value={item.po_item_id}
                        onValueChange={(v) =>
                          updateItem(item._key, { po_item_id: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn dòng PO" />
                        </SelectTrigger>
                        <SelectContent>
                          {poItems.map((p) => (
                            <SelectItem key={p.po_item_id} value={p.po_item_id}>
                              {p.po_code} · {p.product_name} ({p.supplier_name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{po?.quantity ?? '—'}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step={0.1}
                        value={item.weight_kg}
                        onChange={(e) =>
                          updateItem(item._key, {
                            weight_kg: Math.max(0, Number(e.target.value)),
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {pv ? vnd(Math.round(pv.allocUnitVnd)) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {pv ? vnd(Math.round(pv.landedUnitCostVnd)) : '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item._key)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Tổng kết chặng */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Tổng trọng lượng</p>
            <p className="font-semibold">
              {preview.totalWeightKg.toFixed(2)} kg
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Tổng chi phí chặng (VND)
            </p>
            <p className="font-semibold">{vnd(preview.totalCostVnd)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Phân bổ theo</p>
            <p className="font-semibold">Trọng lượng (kg)</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1.5">
        <Label htmlFor="leg_notes">Ghi chú</Label>
        <Input
          id="leg_notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="VD: chuyến ghép tuần 21, gồm PO-0095 và PO-0096"
        />
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Huỷ
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Tạo chặng & phân bổ chi phí
        </Button>
      </div>
    </div>
  );
}
