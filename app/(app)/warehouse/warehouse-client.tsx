'use client';

import * as React from 'react';
import { Truck, ClipboardCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { DeliveryDialog } from '@/app/(app)/sales-orders/delivery-dialog';
import { QCDialog } from './qc-dialog';
import { DefectList } from './defect-list';
import type { DefectWithContext } from '@/lib/types';

interface PendingReceive {
  po_id: string; po_code: string; supplier_name: string;
  po_item_id: string; product_id: string; variant_id: string | null;
  product_name: string; quantity: number; received_qty: number;
  expected_arrival_date: string | null; po_status: string;
  variant_color: string | null; variant_size: string | null;
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
  defects: DefectWithContext[];
}

type ActiveTab = 'receive' | 'deliver' | 'defects' | 'lots';

export function WarehouseClient({ pendingReceive, pendingDeliver, recentMovements, defects }: Props) {
  const [tab, setTab] = React.useState<ActiveTab>('receive');
  const [deliverOrderId, setDeliverOrderId] = React.useState<string | null>(null);
  const [deliverOrderCode, setDeliverOrderCode] = React.useState('');
  const [qcItem, setQcItem] = React.useState<PendingReceive | null>(null);

  const soGroups = React.useMemo(() => {
    const map = new Map<string, { so_id: string; so_code: string; customer_name: string; delivery_date: string | null; so_status: string; items: PendingDeliver[] }>();
    for (const r of pendingDeliver) {
      const key = r.so_id;
      if (!map.has(key)) {
        map.set(key, { so_id: r.so_id, so_code: r.so_code, customer_name: r.customer_name, delivery_date: r.delivery_date, so_status: r.so_status, items: [] });
      }
      map.get(key)!.items.push(r);
    }
    return [...map.values()];
  }, [pendingDeliver]);

  const unresolvedDefects = defects.filter((d) => !d.is_resolved).length;

  const TABS: { key: ActiveTab; label: string; count?: number }[] = [
    { key: 'receive',  label: 'Chờ nhập kho',    count: pendingReceive.length },
    { key: 'deliver',  label: 'Chờ xuất kho',     count: soGroups.length },
    { key: 'defects',  label: 'Hàng lỗi',         count: unresolvedDefects },
    { key: 'lots',     label: 'Lô hàng gần đây' },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition-colors ${
              tab === t.key
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <Badge
                variant={t.key === 'defects' ? 'destructive' : 'warning'}
                className="text-[10px] px-1.5 py-0"
              >
                {t.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Chờ nhập kho */}
      {tab === 'receive' && (
        <div className="rounded-lg border">
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
                    <TableHead className="text-right">Đặt</TableHead>
                    <TableHead className="text-right">Đã nhận</TableHead>
                    <TableHead className="text-right">Còn lại</TableHead>
                    <TableHead>Dự kiến về</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-center">QC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingReceive.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-xs">{r.po_code}</TableCell>
                      <TableCell className="text-xs">{r.supplier_name}</TableCell>
                      <TableCell>
                        <span className="text-sm">{r.product_name}</span>
                        {(r.variant_color || r.variant_size) && (
                          <div className="flex gap-1 mt-0.5">
                            {r.variant_color && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{r.variant_color}</Badge>}
                            {r.variant_size && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{r.variant_size}</Badge>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{r.quantity}</TableCell>
                      <TableCell className="text-right">{r.received_qty}</TableCell>
                      <TableCell className="text-right font-semibold text-amber-600">
                        {r.quantity - r.received_qty}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.expected_arrival_date ? formatDate(r.expected_arrival_date) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{r.po_status}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setQcItem(r)}
                        >
                          <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                          QC
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Chờ xuất kho */}
      {tab === 'deliver' && (
        <div className="rounded-lg border">
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
                      <TableCell>{g.delivery_date ? formatDate(g.delivery_date) : '—'}</TableCell>
                      <TableCell><Badge variant="default">{g.so_status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline"
                          onClick={() => { setDeliverOrderId(g.so_id); setDeliverOrderCode(g.so_code); }}>
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
      )}

      {/* Tab: Hàng lỗi */}
      {tab === 'defects' && <DefectList defects={defects} />}

      {/* Tab: Lô hàng */}
      {tab === 'lots' && (
        <div className="rounded-lg border overflow-x-auto">
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
      )}

      {/* Dialogs */}
      <DeliveryDialog
        orderId={deliverOrderId}
        orderCode={deliverOrderCode}
        open={deliverOrderId !== null}
        onOpenChange={(o) => { if (!o) setDeliverOrderId(null); }}
      />

      {qcItem && (
        <QCDialog
          open={!!qcItem}
          onOpenChange={(o) => { if (!o) setQcItem(null); }}
          poId={qcItem.po_id}
          poCode={qcItem.po_code}
          poItemId={qcItem.po_item_id}
          productId={qcItem.product_id}
          variantId={qcItem.variant_id}
          productName={qcItem.product_name}
          variantLabel={[qcItem.variant_color, qcItem.variant_size].filter(Boolean).join(' / ') || undefined}
          qtyOrdered={qcItem.quantity - qcItem.received_qty}
        />
      )}
    </div>
  );
}
