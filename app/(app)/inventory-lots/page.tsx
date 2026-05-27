import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewCost, type Role } from '@/lib/roles';
import { vnd, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export const metadata = { title: 'Tồn kho theo lô — CREAMEE ERP' };

interface LotRow {
  lot_id: string;
  lot_code: string;
  sku: string;
  product_name: string;
  po_code: string;
  qty_received: number;
  qty_remaining: number;
  goods_unit_cost: number;
  ship_unit_cost: number;
  landed_unit_cost: number;
  received_date: string;
}

export default async function InventoryLotsPage() {
  const profile = await requireAccess('/inventory-lots');
  const showCost = canViewCost(profile.role as Role);

  const { rows: lots } = await query<LotRow>(
    `SELECT il.id AS lot_id, il.lot_code,
            p.sku, p.name AS product_name,
            COALESCE(po.code, '—') AS po_code,
            il.qty_total AS qty_received,
            il.qty_available AS qty_remaining,
            il.goods_unit_cost,
            il.ship_unit_cost,
            (il.goods_unit_cost + il.ship_unit_cost) AS landed_unit_cost,
            DATE(il.created_at) AS received_date
     FROM inventory_lots il
     JOIN products p ON il.product_id = p.id
     LEFT JOIN purchase_order_items poi ON il.po_item_id = poi.id
     LEFT JOIN purchase_orders po ON poi.po_id = po.id
     WHERE il.is_negative = 0
     ORDER BY il.created_at ASC
     LIMIT 1000`,
  );

  const activeLots = lots.filter((l) => l.qty_remaining > 0);
  const totalValue = activeLots.reduce(
    (s, l) => s + l.qty_remaining * l.landed_unit_cost,
    0,
  );

  return (
    <div>
      <PageHeader
        title="Tồn kho theo lô"
        description={
          `${activeLots.length} lô còn hàng` +
          (showCost ? ` • Giá trị tồn: ${vnd(totalValue)}` : '')
        }
      />

      {lots.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
          Chưa có lô hàng nào. Lô được tạo tự động khi đơn nhập có giá vốn.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã lô</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Từ PO</TableHead>
                <TableHead>Ngày nhập</TableHead>
                <TableHead className="text-right">Nhập / Còn</TableHead>
                {showCost && (
                  <>
                    <TableHead className="text-right">Giá vốn hàng</TableHead>
                    <TableHead className="text-right">Ship/cái</TableHead>
                    <TableHead className="text-right">Landed/cái</TableHead>
                  </>
                )}
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.map((l) => (
                <TableRow key={l.lot_id}>
                  <TableCell className="font-medium">{l.lot_code}</TableCell>
                  <TableCell>
                    <div>{l.product_name}</div>
                    <div className="text-xs text-muted-foreground">{l.sku}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.po_code}</TableCell>
                  <TableCell>{formatDate(l.received_date)}</TableCell>
                  <TableCell className="text-right">
                    {l.qty_received} / <b>{l.qty_remaining}</b>
                  </TableCell>
                  {showCost && (
                    <>
                      <TableCell className="text-right">{vnd(l.goods_unit_cost)}</TableCell>
                      <TableCell className="text-right text-amber-600">{vnd(l.ship_unit_cost)}</TableCell>
                      <TableCell className="text-right font-medium">{vnd(l.landed_unit_cost)}</TableCell>
                    </>
                  )}
                  <TableCell>
                    {l.qty_remaining === 0 ? (
                      <Badge variant="secondary">Đã xuất hết</Badge>
                    ) : l.qty_remaining < l.qty_received ? (
                      <Badge variant="warning">Còn một phần</Badge>
                    ) : (
                      <Badge variant="success">Nguyên lô</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Hàng xuất theo nguyên tắc FIFO — lô nhập cũ nhất bán trước. Giá vốn
        mỗi đơn bán được chốt theo lô thực tế tại thời điểm duyệt đơn.
      </p>
    </div>
  );
}
