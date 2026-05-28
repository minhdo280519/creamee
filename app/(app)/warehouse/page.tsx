import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader } from '@/components/page-header';
import { WarehouseClient } from './warehouse-client';

export const metadata = { title: 'Nhập/Xuất kho — CREAMEE ERP' };

export default async function WarehousePage() {
  await requireAccess('/warehouse');

  const [
    { rows: pendingReceive },
    { rows: pendingDeliver },
    { rows: recentMovements },
  ] = await Promise.all([
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
       WHERE so.status IN ('approved','partial_delivered','processing')
         AND soi.delivered_qty < soi.quantity
       ORDER BY so.delivery_date IS NULL, so.delivery_date ASC
       LIMIT 100`,
    ),
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
    <div className="space-y-4">
      <PageHeader
        title="Nhập/Xuất kho"
        description={`${pendingReceive.length} dòng chờ nhập • ${pendingDeliver.length} dòng chờ xuất`}
      />
      <WarehouseClient
        pendingReceive={pendingReceive}
        pendingDeliver={pendingDeliver}
        recentMovements={recentMovements}
      />
    </div>
  );
}
