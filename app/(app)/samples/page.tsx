import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { type Role } from '@/lib/roles';
import { PageHeader } from '@/components/page-header';
import { SamplesClient } from './samples-client';
import { quickCreateCustomer } from '@/app/(app)/customers/actions';
import type { SampleWithRelations } from '@/lib/types';

export const metadata = { title: 'Quản lý mẫu — CREAMEE ERP' };

export default async function SamplesPage() {
  const profile = await requireAccess('/samples');
  const role = profile.role as Role;

  const [
    { rows: sampleRows },
    { rows: customerRows },
    { rows: supplierRows },
    { rows: productRows },
    { rows: settingRows },
  ] = await Promise.all([
    query<{
      id: string; code: string; customer_id: string; product_id: string | null;
      product_name: string; supplier_id: string | null; status: string;
      deposit_amount: number; deposit_paid: number; refund_amount: number;
      goods_cost_cny: number; goods_cost_vnd: number; ship_cost_vnd: number;
      sample_fee_vnd: number; other_cost_vnd: number; fx_rate: number;
      cumulative_qty_ordered: number; notes: string | null;
      created_by: string | null; created_at: string; updated_at: string;
      customer_name: string | null; customer_code: string | null;
      supplier_name: string | null; supplier_code: string | null;
    }>(
      `SELECT s.*,
              c.name AS customer_name, c.code AS customer_code,
              sup.name AS supplier_name, sup.code AS supplier_code
       FROM samples s
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN suppliers sup ON s.supplier_id = sup.id
       ORDER BY s.created_at DESC
       LIMIT 300`,
    ),
    query<{ id: string; name: string }>(
      "SELECT id, name FROM customers WHERE is_active = 1 ORDER BY name",
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
  ]);

  const samples: SampleWithRelations[] = sampleRows.map((r) => ({
    id: r.id,
    code: r.code,
    customer_id: r.customer_id,
    product_id: r.product_id,
    product_name: r.product_name,
    supplier_id: r.supplier_id,
    status: r.status as 'pending' | 'approved' | 'cancelled',
    deposit_amount: Number(r.deposit_amount),
    deposit_paid: Number(r.deposit_paid),
    refund_amount: Number(r.refund_amount),
    goods_cost_cny: Number(r.goods_cost_cny),
    goods_cost_vnd: Number(r.goods_cost_vnd),
    ship_cost_vnd: Number(r.ship_cost_vnd),
    sample_fee_vnd: Number(r.sample_fee_vnd),
    other_cost_vnd: Number(r.other_cost_vnd),
    fx_rate: Number(r.fx_rate),
    cumulative_qty_ordered: Number(r.cumulative_qty_ordered),
    notes: r.notes,
    created_by: r.created_by,
    created_at: r.created_at as unknown as string,
    updated_at: r.updated_at as unknown as string,
    customer: r.customer_name
      ? { id: r.customer_id, code: r.customer_code ?? '', name: r.customer_name }
      : null,
    supplier: r.supplier_name
      ? { id: r.supplier_id ?? '', code: r.supplier_code ?? '', name: r.supplier_name }
      : null,
  }));

  const customers = customerRows.map((c) => ({ id: c.id, label: c.name }));
  const suppliers = supplierRows.map((s) => ({ id: s.id, label: s.name }));
  const products = productRows.map((p) => ({ id: p.id, label: p.name }));
  const defaultFxRate = Number(settingRows[0]?.value ?? 3625);

  const canEdit = ['owner', 'manager', 'warehouse', 'sales'].includes(role);

  const pending = samples.filter((s) => s.status === 'pending').length;
  const totalDeposit = samples.reduce((sum, s) => sum + s.deposit_paid, 0);

  return (
    <div>
      <PageHeader
        title="Quản lý mẫu"
        description={`${samples.length} mẫu` +
          (pending > 0 ? ` • ${pending} chờ duyệt` : '') +
          ` • Tổng cọc: ${totalDeposit.toLocaleString('vi')}₫`}
      />
      <SamplesClient
        samples={samples}
        customers={customers}
        suppliers={suppliers}
        products={products}
        defaultFxRate={defaultFxRate}
        canEdit={canEdit}
        onQuickCreateCustomer={quickCreateCustomer}
      />
    </div>
  );
}
