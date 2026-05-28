'use client';

import * as React from 'react';
import { Truck } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { DeliveryDialog } from '@/app/(app)/sales-orders/delivery-dialog';

interface PendingReceive {
  po_id: string; po_code: string; supplier_name: string;
  product_name: string; quantity: number; received_qty: number;
  expected_arrival_date: string | null; po_status: string;
}

interface PendingDeliver {
  so_id: string; so_code: string; customer_name: string;
  product_name: string; quantity: number; delivered_qty: number;
  delivery_date: string | null; so_status: string;
}

interface RecentMovement {
  lot_code: string; product_name: string; qty_total: number;
  qty_available: number; created_at: string;
}

interface Props {
  pendingReceive: PendingReceive[];
  pendingDeliver: PendingDeliver[];
  recentMovements: RecentMovement[];
}

export function WarehouseClient({ pendingReceive, pendingDeliver, recentMovements }: Props) {
  const [deliverOrderId, setDeliverOrderId] = React.useState<string | null>(null);
  const [deliverOrderCode, setDeliverOrderCode] = React.useState('');

  // Nhóm pendingDeliver theo SO
  const soGroups = React.useMemo(() => {
    const map = new Map<string, { so_id: string; so_code: string; customer_name: string; delivery_date: string | null; so_status: string; items: PendingDeliver[] }>();
    for (const r of pendingDeliver) {
      const key = r.so_id;
      if (!map.has(key)) {
        map.set(key, {
          so_id: r.so_id, so_code: r.so_code, customer_name: r.customer_name,
          delivery_date: r.delivery_date, so_status: r.so_status, items: [],
        });
      }
      map.get(key)!.items.push(r);
    }
    return [...map.values()];
  }, [pendingDeliver]);

  return (
    <div className="space-y-6">
      {/* Chờ nhập kho */}
      <div className="rounded-lg border">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">Hàng chờ nhập kho</h3>
          {pendingReceive.length > 0 && (
            <Badge variant="warning">{pendingReceive.length}</Badge>
          )}
        </div>
        {pendingReceive.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Không có hàng chờ nhập.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã PO</TableHead>
                  <TableHead>Nhà cung cấp</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-right">SL đặt</TableHead>
                  <TableHead className="text-right">Đã nhận</TableHead>
                  <TableHead className="text-right">Còn lại</TableHead>
                  <TableHead>Dự kiến về</TableHead>
                  <TableHead>Trạng thái PO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingReceive.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.po_code}</TableCell>
                    <TableCell>{r.supplier_name}</TableCell>
                    <TableCell>{r.product_name}</TableCell>
                    <TableCell className="text-right">{r.quantity}</TableCell>
                    <TableCell className="text-right">{r.received_qty}</TableCell>
                    <TableCell className="text-right font-semibold text-amber-600">
                      {r.quantity - r.received_qty}
                    </TableCell>
                    <TableCell>
                      {r.expected_arrival_date ? formatDate(r.expected_arrival_date) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.po_status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Chờ xuất kho — nhóm theo SO */}
      <div className="rounded-lg border">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">Hàng chờ xuất kho (giao khách)</h3>
          {soGroups.length > 0 && (
            <Badge variant="warning">{soGroups.length} đơn</Badge>
          )}
        </div>
        {soGroups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Không có hàng chờ xuất.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã SO</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Sản phẩm chờ xuất</TableHead>
                  <TableHead>Ngày giao</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soGroups.map((g) => (
                  <TableRow key={g.so_id}>
                    <TableCell className="font-medium">{g.so_code}</TableCell>
                    <TableCell>{g.customer_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {g.items.map((it) => `${it.product_name} (${it.quantity - it.delivered_qty})`).join(', ')}
                    </TableCell>
                    <TableCell>
                      {g.delivery_date ? formatDate(g.delivery_date) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{g.so_status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDeliverOrderId(g.so_id);
                          setDeliverOrderCode(g.so_code);
                        }}
                      >
                        <Truck className="h-3.5 w-3.5 mr-1" />
                        Xuất kho
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Lô hàng gần đây */}
      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">Lô hàng đã nhập kho gần đây</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã lô</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead className="text-right">Tổng SL</TableHead>
                <TableHead className="text-right">Còn tồn</TableHead>
                <TableHead>Ngày nhập</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentMovements.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-xs">{r.lot_code}</TableCell>
                  <TableCell>{r.product_name}</TableCell>
                  <TableCell className="text-right">{r.qty_total}</TableCell>
                  <TableCell className={`text-right font-medium ${r.qty_available < r.qty_total * 0.2 ? 'text-amber-600' : ''}`}>
                    {r.qty_available}
                  </TableCell>
                  <TableCell>{formatDate(r.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <DeliveryDialog
        orderId={deliverOrderId}
        orderCode={deliverOrderCode}
        open={deliverOrderId !== null}
        onOpenChange={(o) => { if (!o) setDeliverOrderId(null); }}
      />
    </div>
  );
}
