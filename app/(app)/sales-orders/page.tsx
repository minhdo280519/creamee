import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { canApproveOrder, type Role } from '@/lib/roles';
import { PageHeader } from '@/components/page-header';
import { SalesOrdersClient } from './sales-orders-client';
import { quickCreateCustomer } from '@/app/(app)/customers/actions';
import type { SalesOrderWithCustomer } from '@/lib/types';

export const metadata = { title: 'Đơn bán — CREAMEE ERP' };

export default async function SalesOrdersPage() {
  const profile = await requireAccess('/sales-orders');
  const role = profile.role as Role;

  const [{ rows: orderRows }, { rows: customerRows }, { rows: productRows }] =
    await Promise.all([
      query<{
        id: string; code: string; customer_id: string; order_date: string;
        total: number; status: string; payment_status: string; created_by: string | null;
        customer_name: string | null; customer_code: string | null; customer_phone: string | null;
        creator_full_name: string | null;
      }>(
        `SELECT so.id, so.code, so.customer_id, so.order_date, so.total,
                so.status, so.payment_status, so.created_by,
                c.code AS customer_code, c.name AS customer_name, c.phone AS customer_phone,
                p.full_name AS creator_full_name
         FROM sales_orders so
         LEFT JOIN customers c ON so.customer_id = c.id
         LEFT JOIN profiles p ON so.created_by = p.id
         ORDER BY so.order_date DESC
         LIMIT 300`,
      ),
      query<{ id: string; name: string }>(
        "SELECT id, name FROM customers WHERE is_active = 1 ORDER BY name",
      ),
      query<{ id: string; name: string; base_price_vnd: number; wholesale_price_vnd: number | null }>(
        "SELECT id, name, base_price_vnd, wholesale_price_vnd FROM products WHERE is_active = 1 ORDER BY name",
      ),
    ]);

  const orders: SalesOrderWithCustomer[] = orderRows.map((r) => ({
    ...r,
    customer: r.customer_name
      ? { id: r.customer_id, code: r.customer_code ?? '', name: r.customer_name, phone: r.customer_phone }
      : null,
    creator: r.creator_full_name
      ? { id: r.created_by ?? '', full_name: r.creator_full_name }
      : null,
  })) as unknown as SalesOrderWithCustomer[];

  const customers = customerRows.map((c) => ({ id: c.id, label: c.name }));
  const products = productRows.map((p) => ({
    id: p.id,
    label: p.name,
    base_price_vnd: p.base_price_vnd,
    wholesale_price_vnd: p.wholesale_price_vnd,
  }));

  const canCreate = ['owner', 'manager', 'sales'].includes(role);
  const canApprove = canApproveOrder(role);
  const pending = orders.filter((o) => o.status === 'pending_approval').length;

  return (
    <div>
      <PageHeader
        title="Đơn bán hàng"
        description={`${orders.length} đơn` + (pending > 0 ? ` • ${pending} đơn chờ duyệt` : '')}
      />
      <SalesOrdersClient
        orders={orders}
        customers={customers}
        products={products}
        canCreate={canCreate}
        canApprove={canApprove}
        onQuickCreateCustomer={quickCreateCustomer}
      />
    </div>
  );
}
