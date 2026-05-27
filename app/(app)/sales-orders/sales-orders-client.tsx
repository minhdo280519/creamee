'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Check, X, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { vnd, formatDate } from '@/lib/utils';
import {
  ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT,
  PAYMENT_STATUS_LABEL, PAYMENT_STATUS_VARIANT,
} from '@/lib/order-status';
import type { SalesOrderWithCustomer } from '@/lib/types';
import { approveSalesOrder, rejectSalesOrder } from './actions';
import { SalesOrderForm } from './sales-order-form';
import { DeliveryDialog } from './delivery-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { EntityOption } from '@/components/entity-combobox';

interface ProductOption {
  id: string;
  label: string;
  base_price_vnd: number;
  wholesale_price_vnd: number | null;
}

interface Props {
  orders: SalesOrderWithCustomer[];
  customers: EntityOption[];
  products: ProductOption[];
  canCreate: boolean;
  canApprove: boolean;
  onQuickCreateCustomer: (name: string) => Promise<EntityOption>;
}

export function SalesOrdersClient({
  orders, customers, products, canCreate, canApprove, onQuickCreateCustomer,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [formOpen, setFormOpen] = React.useState(false);
  // Đơn đang mở dialog giao hàng.
  const [deliverOrderId, setDeliverOrderId] = React.useState<string | null>(null);
  const [deliverOrderCode, setDeliverOrderCode] = React.useState('');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.code.toLowerCase().includes(q) ||
        (o.customer?.name ?? '').toLowerCase().includes(q),
    );
  }, [orders, query]);

  async function handleApprove(id: string) {
    const r = await approveSalesOrder(id);
    if (!r.ok) {
      toast.error(r.error ?? 'Duyệt thất bại');
      return;
    }
    toast.success('Đã duyệt đơn');
    router.refresh();
  }

  async function handleReject(id: string) {
    const reason = window.prompt('Lý do từ chối đơn:');
    if (reason == null) return;
    const r = await rejectSalesOrder(id, reason);
    if (!r.ok) {
      toast.error(r.error ?? 'Từ chối thất bại');
      return;
    }
    toast.success('Đã từ chối đơn');
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã đơn, khách hàng..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {canCreate && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Tạo đơn
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
          {query ? 'Không tìm thấy đơn.' : 'Chưa có đơn bán nào.'}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Ngày đặt</TableHead>
                <TableHead className="text-right">Tổng tiền</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thanh toán</TableHead>
                <TableHead>NV tạo</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.code}</TableCell>
                  <TableCell>{o.customer?.name ?? '—'}</TableCell>
                  <TableCell>{formatDate(o.order_date)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {vnd(o.total)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={PAYMENT_STATUS_VARIANT[o.payment_status]}>
                      {PAYMENT_STATUS_LABEL[o.payment_status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.creator?.full_name ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {/* Duyệt / từ chối — đơn chờ duyệt. */}
                      {canApprove && o.status === 'pending_approval' && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleApprove(o.id)}
                          >
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleReject(o.id)}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {/* Giao hàng — đơn đã duyệt, chưa giao. */}
                      {o.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDeliverOrderId(o.id);
                            setDeliverOrderCode(o.code);
                          }}
                        >
                          <Truck className="h-3.5 w-3.5" />
                          Giao hàng
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Tạo đơn bán mới</DialogTitle>
          </DialogHeader>
          <SalesOrderForm
            customers={customers}
            products={products}
            onQuickCreateCustomer={onQuickCreateCustomer}
            onClose={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <DeliveryDialog
        orderId={deliverOrderId}
        orderCode={deliverOrderCode}
        open={deliverOrderId !== null}
        onOpenChange={(o) => {
          if (!o) setDeliverOrderId(null);
        }}
      />
    </div>
  );
}
