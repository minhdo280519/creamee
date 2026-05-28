import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader } from '@/components/page-header';
import { LogisticsClient } from './logistics-client';
import type { POItemOption } from './leg-form';
import type { ShipmentLeg } from '@/lib/landed-cost';

export const metadata = { title: 'Vận chuyển — CREAMEE ERP' };

export default async function LogisticsPage() {
  await requireAccess('/logistics');

  const [
    { rows: carrierRows },
    { rows: legRows },
    { rows: poItemRows },
    { rows: settingRows },
    { rows: poShipRows },
    { rows: soRows },
  ] = await Promise.all([
    query<{
      id: string; name: string; contact: string | null;
      rate_cny_per_kg: number; min_charge_cny: number; is_active: number;
    }>('SELECT * FROM shipping_carriers ORDER BY name'),
    query<{
      id: string; code: string; leg: ShipmentLeg;
      total_weight_kg: number; total_cost_vnd: number; charge_mode: string;
      delay_status: string | null; created_at: string; carrier_name: string | null;
    }>(
      `SELECT s.id, s.code, s.leg, s.total_weight_kg, s.total_cost_vnd,
              s.charge_mode, s.delay_status, s.created_at,
              sc.name AS carrier_name
       FROM shipments s
       LEFT JOIN shipping_carriers sc ON s.carrier_id = sc.id
       ORDER BY s.created_at DESC
       LIMIT 200`,
    ),
    query<{
      id: string; po_id: string; product_id: string; product_name_snapshot: string;
      quantity: number; line_total_cny: number; po_code: string; fx_rate: number;
      supplier_name: string | null;
    }>(
      `SELECT poi.id, poi.po_id, poi.product_id, poi.product_name_snapshot,
              poi.quantity, poi.line_total_cny,
              po.code AS po_code, po.fx_rate,
              s.name AS supplier_name
       FROM purchase_order_items poi
       JOIN purchase_orders po ON poi.po_id = po.id
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       LIMIT 1000`,
    ),
    query<{ value: number }>(
      "SELECT value FROM app_settings WHERE `key` = 'fx_cny_vnd' LIMIT 1",
    ),
    query<{
      po_id: string; po_code: string; supplier_name: string;
      goods_total_vnd: number; total_ship_cost_vnd: number;
      landed_total_vnd: number; leg_count: number;
    }>(
      `SELECT po.id AS po_id, po.code AS po_code,
              COALESCE(s.name, '—') AS supplier_name,
              ROUND(po.total_vnd - po.shipping_cny * po.fx_rate) AS goods_total_vnd,
              COALESCE(SUM(si.alloc_cost_vnd), 0) AS total_ship_cost_vnd,
              po.total_vnd + COALESCE(SUM(si.alloc_cost_vnd), 0) AS landed_total_vnd,
              COUNT(DISTINCT shp.id) AS leg_count
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
       LEFT JOIN shipment_items si ON si.po_item_id = poi.id
       LEFT JOIN shipments shp ON si.shipment_id = shp.id
       GROUP BY po.id
       LIMIT 300`,
    ),
    query<{ id: string; code: string; customer_name: string }>(
      `SELECT so.id, so.code, COALESCE(c.name, '—') AS customer_name
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       WHERE so.status NOT IN ('cancelled','completed')
       ORDER BY so.order_date DESC LIMIT 200`,
    ),
  ]);

  const carriers = carrierRows.map((c) => ({ ...c, is_active: Boolean(c.is_active) }));
  const legs = legRows.map((l) => ({
    ...l,
    carrier: l.carrier_name ? { name: l.carrier_name } : null,
  }));
  const poItems: POItemOption[] = poItemRows.map((it) => ({
    po_item_id: it.id,
    po_id: it.po_id,
    po_code: it.po_code ?? '—',
    supplier_name: it.supplier_name ?? '—',
    product_id: it.product_id,
    product_name: it.product_name_snapshot,
    quantity: it.quantity,
    goods_cost_vnd: Math.round(it.line_total_cny * (it.fx_rate ?? 1)),
  }));
  const defaultFxRate = Number(settingRows[0]?.value ?? 4060);
  const salesOrders = soRows.map((r) => ({ id: r.id, code: r.code, customer_name: r.customer_name }));

  return (
    <div>
      <PageHeader
        title="Vận chuyển & Chi phí"
        description="Mỗi chặng là một lần vận chuyển — chi phí phân bổ theo kg về từng đơn mua"
      />
      <LogisticsClient
        carriers={carriers}
        legs={legs}
        poShipRows={poShipRows}
        poItems={poItems}
        salesOrders={salesOrders}
        defaultFxRate={defaultFxRate}
      />
    </div>
  );
}
