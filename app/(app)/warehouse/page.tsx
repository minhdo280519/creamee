import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader } from '@/components/page-header';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Nhập/Xuất kho — CREAMEE ERP' };

export default async function WarehousePage() {
  await requireAccess('/warehouse');

  const [
    { rows: pendingReceive },
    { rows: pendingDeliver },
    { rows: recentMovements },
  ] = await Promise.all([
    // PO đã đặt nhưng chưa nhận hàng
    query<{
      po_id: string; po_code: string; supplier_name: string;
      product_name: string; quantity: number; received_qty: number;
      expected_arrival_date: string | null; po_status: string;
    }>(
      `SELECT po.id AS po_id, po.code AS po_code,
              COALESCE(s.name, '—') AS supplier_name,
              poi.product_name_snapshot AS product_name,
              poi.quantity, poi.received_qty,
              po.expected_arrival_date, po.status AS po_status
       FROM purchase_order_items poi
       JOIN purchase_orders po ON poi.po_id = po.id
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.status IN ('ordered','draft','sent','confirmed','shipping','received')
         AND poi.received_qty < poi.quantity
       ORDER BY po.expected_arrival_date IS NULL, po.expected_arrival_date ASC
       LIMIT 100`,
    ),
    // SO đã duyệt nhưng chưa giao hàng
    query<{
      so_id: string; so_code: string; customer_name: string;
      product_name: string; quantity: number; delivered_qty: number;
      delivery_date: string | null; so_status: string;
    }>(
      `SELECT so.id AS so_id, so.code AS so_code,
              COALESCE(c.name, '—') AS customer_name,
              soi.product_name_snapshot AS product_name,
              soi.quantity, soi.delivered_qty,
              so.delivery_date, so.status AS so_status
       FROM sales_order_items soi
       JOIN sales_orders so ON soi.order_id = so.id
       LEFT JOIN customers c ON so.customer_id = c.id
       WHERE so.status IN ('approved','partial_delivered')
         AND soi.delivered_qty < soi.quantity
       ORDER BY so.delivery_date IS NULL, so.delivery_date ASC
       LIMIT 100`,
    ),
    // Lô nhập kho gần đây
    query<{
      lot_code: string; product_name: string; qty_total: number;
      qty_available: number; created_at: string;
    }>(
      `SELECT il.lot_code, p.name AS product_name,
              il.qty_total, il.qty_available, il.created_at
       FROM inventory_lots il
       JOIN products p ON il.product_id = p.id
       ORDER BY il.created_at DESC
       LIMIT 30`,
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhập/Xuất kho"
        description={`${pendingReceive.length} dòng chờ nhập • ${pendingDeliver.length} dòng chờ xuất`}
      />

      {/* Task: Chờ nhập kho */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Hàng chờ nhập kho
            {pendingReceive.length > 0 && (
              <Badge variant="warning">{pendingReceive.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pendingReceive.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Không có hàng chờ nhập.
            </p>
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
        </CardContent>
      </Card>

      {/* Task: Chờ xuất kho */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Hàng chờ xuất kho (giao khách)
            {pendingDeliver.length > 0 && (
              <Badge variant="warning">{pendingDeliver.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pendingDeliver.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Không có hàng chờ xuất.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã SO</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead className="text-right">SL đơn</TableHead>
                    <TableHead className="text-right">Đã giao</TableHead>
                    <TableHead className="text-right">Còn lại</TableHead>
                    <TableHead>Ngày giao</TableHead>
                    <TableHead>Trạng thái SO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingDeliver.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.so_code}</TableCell>
                      <TableCell>{r.customer_name}</TableCell>
                      <TableCell>{r.product_name}</TableCell>
                      <TableCell className="text-right">{r.quantity}</TableCell>
                      <TableCell className="text-right">{r.delivered_qty}</TableCell>
                      <TableCell className="text-right font-semibold text-blue-600">
                        {r.quantity - r.delivered_qty}
                      </TableCell>
                      <TableCell>
                        {r.delivery_date ? formatDate(r.delivery_date) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{r.so_status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lô nhập kho gần đây */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lô hàng đã nhập kho gần đây</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                    <TableCell className="text-right">{r.qty_available}</TableCell>
                    <TableCell>{formatDate(r.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
