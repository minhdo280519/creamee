import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { type Role } from '@/lib/roles';
import { PageHeader } from '@/components/page-header';
import { POClient } from './po-client';
import { quickCreateSupplier } from '@/app/(app)/products/actions';

export const metadata = { title: 'Đơn nhập hàng — CREAMEE ERP' };

export default async function PurchaseOrdersPage() {
  const profile = await requireAccess('/purchase-orders');

  const [{ rows: poRows }, { rows: supplierRows }, { rows: productRows }, { rows: settingRows }, { rows: soRows }] =
    await Promise.all([
      query<{
        id: string; code: string; order_date: string; expected_arrival_date: string | null;
        total_cny: number; total_vnd: number; paid_cny: number; status: string;
        payment_status: string; supplier_name: string | null; so_code: string | null;
      }>(
        `SELECT po.id, po.code, po.order_date, po.expected_arrival_date,
                po.total_cny, po.total_vnd, po.paid_cny, po.status, po.payment_status,
                s.name AS supplier_name, po.so_code
         FROM purchase_orders po
         LEFT JOIN suppliers s ON po.supplier_id = s.id
         ORDER BY po.order_date DESC
         LIMIT 300`,
      ),
      query<{ id: string; name: string }>(
        "SELECT id, name FROM suppliers WHERE is_active = 1 ORDER BY name",
      ),
      query<{ id: string; name: string }>(
        "SELECT id, name FROM products WHERE is_active = 1 ORDER BY name",
      ),
      query<{ value: number }>(
        "SELECT value FROM app_settings WHERE `key` = 'fx_cny_vnd' LIMIT 1",
      ),
      query<{ id: string; code: string; customer_name: string }>(
        `SELECT so.id, so.code, c.name AS customer_name
         FROM sales_orders so
         LEFT JOIN customers c ON so.customer_id = c.id
         WHERE so.status NOT IN ('cancelled','completed')
         ORDER BY so.order_date DESC LIMIT 200`,
      ),
    ]);

  const orders = poRows.map((r) => ({
    ...r,
    supplier: r.supplier_name ? { name: r.supplier_name } : null,
  }));
  const suppliers = supplierRows.map((s) => ({ id: s.id, label: s.name }));
  const products = productRows.map((p) => ({ id: p.id, label: p.name }));
  const salesOrders = soRows.map((r) => ({ id: r.id, code: r.code, customer_name: r.customer_name ?? '' }));
  const defaultFxRate = Number(settingRows[0]?.value ?? 4060);

  const canEdit = ['owner', 'manager', 'warehouse'].includes(profile.role as Role);

  return (
    <div>
      <PageHeader
        title="Đơn nhập hàng (PO)"
        description={`${orders.length} đơn nhập từ nhà cung cấp`}
      />
      <POClient
        orders={orders}
        suppliers={suppliers}
        products={products}
        salesOrders={salesOrders}
        defaultFxRate={defaultFxRate}
        canEdit={canEdit}
        onQuickCreateSupplier={quickCreateSupplier}
      />
    </div>
  );
}
