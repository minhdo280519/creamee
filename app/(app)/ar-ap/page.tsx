import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader } from '@/components/page-header';
import { ArApClient } from './ar-ap-client';

export const metadata = { title: 'Công nợ — CREAMEE ERP' };

export default async function ArApPage() {
  await requireAccess('/ar-ap');

  const [{ rows: arRows }, { rows: apRows }] = await Promise.all([
    query<{
      order_id: string; order_code: string; customer_name: string;
      total: number; paid_amount: number; outstanding: number; days_outstanding: number;
    }>(
      `SELECT so.id AS order_id, so.code AS order_code,
              c.name AS customer_name,
              so.total, so.paid_amount,
              (so.total - so.paid_amount) AS outstanding,
              DATEDIFF(NOW(), so.order_date) AS days_outstanding
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       WHERE so.payment_status != 'paid'
         AND so.status NOT IN ('cancelled','draft')
       ORDER BY days_outstanding DESC
       LIMIT 500`,
    ),
    query<{
      po_id: string; po_code: string; supplier_name: string;
      total_cny: number; paid_cny: number; outstanding_cny: number;
    }>(
      `SELECT po.id AS po_id, po.code AS po_code,
              s.name AS supplier_name,
              po.total_cny, po.paid_cny,
              (po.total_cny - po.paid_cny) AS outstanding_cny
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.payment_status != 'paid'
         AND po.status NOT IN ('cancelled','draft')
       ORDER BY po.order_date ASC
       LIMIT 500`,
    ),
  ]);

  const receivables = arRows.map((r) => ({
    order_id: r.order_id,
    order_code: r.order_code,
    customer_name: r.customer_name ?? '—',
    total: Number(r.total),
    paid: Number(r.paid_amount),
    outstanding: Number(r.outstanding),
    days_outstanding: Number(r.days_outstanding),
  }));

  const payables = apRows.map((p) => ({
    po_id: p.po_id,
    po_code: p.po_code,
    supplier_name: p.supplier_name ?? '—',
    total_cny: Number(p.total_cny),
    paid_cny: Number(p.paid_cny),
    outstanding_cny: Number(p.outstanding_cny),
  }));

  return (
    <div>
      <PageHeader
        title="Công nợ"
        description="Theo dõi công nợ phải thu khách hàng và phải trả nhà cung cấp"
      />
      <ArApClient receivables={receivables} payables={payables} />
    </div>
  );
}
