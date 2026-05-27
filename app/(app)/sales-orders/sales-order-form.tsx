'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { vnd } from '@/lib/utils';
import { calcOrderTotal, type OrderLineInput } from '@/lib/business-logic';
import { createSalesOrder, type SOLineDraft } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { EntityCombobox, type EntityOption } from '@/components/entity-combobox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface ProductOption {
  id: string;
  label: string;
  base_price_vnd: number;
  wholesale_price_vnd: number | null;
}

interface Props {
  customers: EntityOption[];
  products: ProductOption[];
  /** Tạo nhanh khách hàng cho combobox auto-add. */
  onQuickCreateCustomer: (name: string) => Promise<EntityOption>;
  onClose: () => void;
}

interface DraftLine extends SOLineDraft {
  /** key React. */
  _key: string;
}

const APPROVAL_THRESHOLD = 50_000_000;

export function SalesOrderForm({
  customers, products, onQuickCreateCustomer, onClose,
}: Props) {
  const router = useRouter();
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [orderDate, setOrderDate] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [deliveryAddress, setDeliveryAddress] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [discountValue, setDiscountValue] = React.useState(0);
  const [discountType, setDiscountType] = React.useState<'percent' | 'fixed'>('percent');
  const [shippingFee, setShippingFee] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  const [lines, setLines] = React.useState<DraftLine[]>([
    { _key: crypto.randomUUID(), product_id: '', product_name: '', quantity: 1, unit_price: 0, discount_pct: 0 },
  ]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      { _key: crypto.randomUUID(), product_id: '', product_name: '', quantity: 1, unit_price: 0, discount_pct: 0 },
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l._key !== key) : prev));
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l._key === key ? { ...l, ...patch } : l)));
  }

  // Chọn sản phẩm → tự điền tên + giá sỉ (ưu tiên) hoặc giá lẻ.
  function pickProduct(key: string, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    updateLine(key, {
      product_id: productId,
      product_name: p.label,
      unit_price: p.wholesale_price_vnd ?? p.base_price_vnd,
    });
  }

  // Tính tổng realtime.
  const totals = React.useMemo(() => {
    const input: OrderLineInput[] = lines.map((l) => ({
      qtyOrdered: l.quantity,
      unitPrice: l.unit_price,
      lineDiscountPercent: l.discount_pct / 100,
    }));
    return calcOrderTotal(
      input,
      { value: discountValue, type: discountType },
      shippingFee,
    );
  }, [lines, discountValue, discountType, shippingFee]);

  const needsApproval = totals.total > APPROVAL_THRESHOLD;

  async function handleSave() {
    if (!customerId) {
      toast.error('Vui lòng chọn khách hàng');
      return;
    }
    const validLines = lines.filter((l) => l.product_id && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error('Đơn cần ít nhất 1 sản phẩm hợp lệ');
      return;
    }

    setSaving(true);
    try {
      const result = await createSalesOrder({
        customer_id: customerId,
        order_date: orderDate,
        delivery_address: deliveryAddress,
        notes,
        items: validLines.map((l) => ({
          product_id: l.product_id,
          product_name: l.product_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct,
        })),
        order_discount_value: discountValue,
        order_discount_type: discountType,
        shipping_fee: shippingFee,
      });

      if (!result.ok) {
        toast.error(result.error ?? 'Tạo đơn thất bại');
        return;
      }
      toast.success(
        `Đã tạo đơn ${result.data?.code}` +
          (needsApproval ? ' — đang chờ duyệt' : ''),
      );
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Thông tin chung */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Khách hàng <span className="text-destructive">*</span></Label>
          <EntityCombobox
            options={customers}
            value={customerId}
            onChange={setCustomerId}
            entityLabel="khách hàng"
            placeholder="Chọn hoặc tạo khách hàng"
            onCreate={onQuickCreateCustomer}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="order_date">Ngày đặt</Label>
          <Input
            id="order_date"
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="delivery_address">Địa chỉ giao hàng</Label>
          <Input
            id="delivery_address"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Để trống nếu lấy theo địa chỉ KH"
          />
        </div>
      </div>

      {/* Bảng sản phẩm multi-line */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Sản phẩm</Label>
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
                <TableHead className="w-36">Đơn giá</TableHead>
                <TableHead className="w-24">CK %</TableHead>
                <TableHead className="w-36 text-right">Thành tiền</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => {
                const lineTotal =
                  line.quantity * line.unit_price * (1 - line.discount_pct / 100);
                return (
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
                        step={1000}
                        value={line.unit_price}
                        onChange={(e) =>
                          updateLine(line._key, {
                            unit_price: Math.max(0, Number(e.target.value)),
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={line.discount_pct}
                        onChange={(e) =>
                          updateLine(line._key, {
                            discount_pct: Math.min(100, Math.max(0, Number(e.target.value))),
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {vnd(lineTotal)}
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Chiết khấu + phụ phí + tổng */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Chiết khấu toàn đơn</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                value={discountValue}
                onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
              />
              <Select
                value={discountType}
                onValueChange={(v) => setDiscountType(v as 'percent' | 'fixed')}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">%</SelectItem>
                  <SelectItem value="fixed">VND</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipping_fee">Phụ phí / Ship</Label>
            <Input
              id="shipping_fee"
              type="number"
              step={1000}
              value={shippingFee}
              onChange={(e) => setShippingFee(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tạm tính</span>
              <span>{vnd(totals.subTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chiết khấu</span>
              <span className="text-destructive">− {vnd(totals.discountAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phụ phí</span>
              <span>+ {vnd(shippingFee)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Tổng cộng</span>
              <span>{vnd(totals.total)}</span>
            </div>
            {needsApproval && (
              <p className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                Đơn vượt {vnd(APPROVAL_THRESHOLD)} — sẽ cần quản lý duyệt.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Huỷ
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Tạo đơn
        </Button>
      </div>
    </div>
  );
}
