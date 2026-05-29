'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { vnd } from '@/lib/utils';
import { calcOrderTotal, type OrderLineInput } from '@/lib/business-logic';
import { createSalesOrder, updateSalesOrder, type SOLineDraft, type UpdateSODraft } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { EntityCombobox, type EntityOption } from '@/components/entity-combobox';
import { VariantPicker } from '@/components/variant-picker';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface ProductOption {
  id: string;
  label: string;
  base_price_vnd: number;
  wholesale_price_vnd: number | null;
}

interface EditingOrder {
  id: string;
  customer_id: string;
  order_date: string;
  delivery_date: string | null;
  delivery_address: string | null;
  notes: string | null;
  deposit_amount: number;
  discount_amount: number;
  shipping_fee: number;
}

interface Props {
  customers: EntityOption[];
  products: ProductOption[];
  onQuickCreateCustomer: (name: string) => Promise<EntityOption>;
  onQuickCreateProduct: (name: string) => Promise<EntityOption>;
  onClose: () => void;
  editing?: EditingOrder;
  editingItems?: DraftLine[];
}

interface DraftLine extends SOLineDraft {
  _key: string;
  variant_id?: string | null;
  variant_label?: string;
}

const APPROVAL_THRESHOLD = 50_000_000;

export function SalesOrderForm({
  customers, products, onQuickCreateCustomer, onQuickCreateProduct, onClose, editing, editingItems,
}: Props) {
  const router = useRouter();
  const isEdit = !!editing;
  const [customerId, setCustomerId] = React.useState<string | null>(editing?.customer_id ?? null);
  const [orderDate, setOrderDate] = React.useState(
    editing?.order_date ?? new Date().toISOString().slice(0, 10),
  );
  const [deliveryAddress, setDeliveryAddress] = React.useState(editing?.delivery_address ?? '');
  const [notes, setNotes] = React.useState(editing?.notes ?? '');
  const [discountValue, setDiscountValue] = React.useState(0);
  const [discountType, setDiscountType] = React.useState<'percent' | 'fixed'>('fixed');
  const [shippingFee, setShippingFee] = React.useState(editing?.shipping_fee ?? 0);
  const [depositAmount, setDepositAmount] = React.useState(editing?.deposit_amount ?? 0);
  const [saving, setSaving] = React.useState(false);

  // Ref để track sản phẩm mới tạo inline (tránh stale closure)
  const productMapRef = React.useRef(new Map(products.map((p) => [p.id, p])));

  const [lines, setLines] = React.useState<DraftLine[]>(
    editingItems ?? [
      { _key: crypto.randomUUID(), product_id: '', product_name: '', quantity: 1, unit_price: 0, discount_pct: 0 },
    ],
  );

  React.useEffect(() => {
    if (editing) {
      setDiscountValue(editing.discount_amount);
      setDiscountType('fixed');
    }
  }, [editing]);

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

  function pickProduct(key: string, id: string | null) {
    if (!id) {
      updateLine(key, { product_id: '', product_name: '', variant_id: null, variant_label: '' });
      return;
    }
    const p = productMapRef.current.get(id);
    updateLine(key, {
      product_id: id,
      product_name: p?.label ?? '',
      unit_price: p ? (p.wholesale_price_vnd ?? p.base_price_vnd) : 0,
      variant_id: null,
      variant_label: '',
    });
  }

  function pickVariant(key: string, variant: import('@/lib/types').ProductVariant | null) {
    if (!variant) { updateLine(key, { variant_id: null, variant_label: '' }); return; }
    const label = [variant.color, variant.size].filter(Boolean).join(' / ') || variant.sku;
    updateLine(key, {
      variant_id: variant.id,
      variant_label: label,
      // Dùng giá variant nếu có, không thì giữ nguyên
      unit_price: variant.price_vnd > 0 ? variant.price_vnd : undefined,
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
    const validLines = lines.filter((l) => l.product_id && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error('Đơn cần ít nhất 1 sản phẩm hợp lệ');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && editing) {
        const result = await updateSalesOrder({
          order_id: editing.id,
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
          deposit_amount: depositAmount,
        } satisfies UpdateSODraft);
        if (!result.ok) { toast.error(result.error ?? 'Cập nhật thất bại'); return; }
        toast.success('Đã cập nhật đơn');
      } else {
        if (!customerId) { toast.error('Vui lòng chọn khách hàng'); return; }
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
          deposit_amount: depositAmount,
        });
        if (!result.ok) { toast.error(result.error ?? 'Tạo đơn thất bại'); return; }
        toast.success(
          `Đã tạo đơn ${result.data?.code}` + (needsApproval ? ' — đang chờ duyệt' : ''),
        );
      }
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
          {isEdit ? (
            <Input value={customers.find((c) => c.id === customerId)?.label ?? ''} readOnly className="bg-muted" />
          ) : (
            <EntityCombobox
              options={customers}
              value={customerId}
              onChange={setCustomerId}
              entityLabel="khách hàng"
              placeholder="Chọn hoặc tạo khách hàng"
              onCreate={onQuickCreateCustomer}
            />
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="order_date">Ngày đặt</Label>
          <Input
            id="order_date"
            type="date"
            value={orderDate}
            readOnly={isEdit}
            className={isEdit ? 'bg-muted' : ''}
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
                <TableHead className="min-w-[220px]">Sản phẩm / Variant</TableHead>
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
                      <EntityCombobox
                        options={products}
                        value={line.product_id || null}
                        onChange={(id) => pickProduct(line._key, id)}
                        entityLabel="sản phẩm"
                        placeholder="Chọn sản phẩm"
                        onCreate={async (name) => {
                          const created = await onQuickCreateProduct(name);
                          productMapRef.current.set(created.id, {
                            id: created.id, label: created.label,
                            base_price_vnd: 0, wholesale_price_vnd: null,
                          });
                          return created;
                        }}
                      />
                      <VariantPicker
                        productId={line.product_id || null}
                        selectedVariantId={line.variant_id ?? null}
                        onSelect={(v) => pickVariant(line._key, v)}
                      />
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
            <Label htmlFor="deposit_amount">Tiền cọc từ khách (VND)</Label>
            <Input
              id="deposit_amount"
              type="number"
              step={100000}
              value={depositAmount}
              onChange={(e) => setDepositAmount(Math.max(0, Number(e.target.value)))}
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
            {depositAmount > 0 && (
              <div className="flex justify-between text-sm text-green-700">
                <span>Tiền cọc đã nhận</span>
                <span>− {vnd(depositAmount)}</span>
              </div>
            )}
            {depositAmount > 0 && (
              <div className="flex justify-between text-sm font-medium">
                <span>Còn lại</span>
                <span>{vnd(Math.max(0, totals.total - depositAmount))}</span>
              </div>
            )}
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
          {isEdit ? 'Lưu thay đổi' : 'Tạo đơn'}
        </Button>
      </div>
    </div>
  );
}
