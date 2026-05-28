'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { generateCode } from '@/lib/db/helpers';
import { calcPOTotal, type POLineInput } from '@/lib/business-logic';
import type { ActionResult } from '@/app/(app)/customers/actions';

export interface POLineDraft {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost_cny: number;
}

export interface CreatePODraft {
  supplier_id: string;
  so_id?: string;
  so_code?: string;
  order_date: string;
  expected_arrival_date?: string;
  fx_rate: number;
  shipping_cny: number;
  notes?: string;
  items: POLineDraft[];
}

/** Tạo đơn nhập hàng (PO) — đa dòng, tiền CNY. */
export async function createPurchaseOrder(
  draft: CreatePODraft,
): Promise<ActionResult<{ id: string; code: string }>> {
  const profile = await requireUser();

  if (!draft.supplier_id) return { ok: false, error: 'Vui lòng chọn nhà cung cấp' };
  if (draft.items.length === 0) return { ok: false, error: 'PO cần ít nhất 1 sản phẩm' };
  if (draft.fx_rate <= 0) return { ok: false, error: 'Tỷ giá không hợp lệ' };

  for (const [i, it] of draft.items.entries()) {
    if (!it.product_id) return { ok: false, error: `Dòng ${i + 1}: chưa chọn sản phẩm` };
    if (it.quantity <= 0) return { ok: false, error: `Dòng ${i + 1}: số lượng phải > 0` };
  }

  const lines: POLineInput[] = draft.items.map((it) => ({
    qty: it.quantity, unitPriceCNY: it.unit_cost_cny, otherFeeCNY: 0,
  }));
  const lineTotals = calcPOTotal(lines, draft.fx_rate);
  const subtotalCny = lineTotals.totalCNY;
  const totalCny = subtotalCny + draft.shipping_cny;
  const totalVnd = Math.round(totalCny * draft.fx_rate);

  const code = await generateCode('PO');
  const id = crypto.randomUUID();

  const { affectedRows } = await query(
    `INSERT INTO purchase_orders
     (id, code, supplier_id, so_id, so_code, order_date, expected_arrival_date, currency, fx_rate,
      subtotal_cny, shipping_cny, total_cny, total_vnd, status, payment_status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'CNY', ?, ?, ?, ?, ?, 'draft', 'unpaid', ?, ?)`,
    [
      id, code, draft.supplier_id,
      draft.so_id || null, draft.so_code || null,
      draft.order_date,
      draft.expected_arrival_date || null, draft.fx_rate,
      subtotalCny, draft.shipping_cny, totalCny, totalVnd,
      draft.notes || null, profile.id,
    ],
  );

  if (affectedRows === 0) return { ok: false, error: 'Không tạo được PO' };

  // Insert items.
  for (const [idx, it] of draft.items.entries()) {
    await query(
      `INSERT INTO purchase_order_items
       (id, po_id, product_id, product_name_snapshot, quantity, received_qty,
        unit_cost_cny, line_total_cny, sort_order)
       VALUES (UUID(), ?, ?, ?, ?, 0, ?, ?, ?)`,
      [id, it.product_id, it.product_name, it.quantity,
       it.unit_cost_cny, it.quantity * it.unit_cost_cny, idx],
    );
  }

  revalidatePath('/purchase-orders');
  return { ok: true, data: { id, code } };
}

/** Cập nhật trạng thái PO. */
export async function updatePOStatus(id: string, status: string): Promise<ActionResult> {
  await requireUser();
  await query('UPDATE purchase_orders SET status = ? WHERE id = ?', [status, id]);
  revalidatePath('/purchase-orders');
  return { ok: true };
}

// ── PO Detail ──────────────────────────────────────────────────────────────

export interface PODetailItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  received_qty: number;
  unit_cost_cny: number;
  line_total_cny: number;
  so_id: string | null;
  so_code: string | null;
}

export interface PODetailData {
  id: string; code: string;
  supplier_id: string; supplier_name: string; supplier_code: string;
  so_id: string | null; so_code: string | null;
  order_date: string; expected_arrival_date: string | null;
  fx_rate: number; subtotal_cny: number; shipping_cny: number;
  total_cny: number; total_vnd: number; paid_cny: number;
  status: string; payment_status: string; notes: string | null;
  created_by_name: string | null;
  items: PODetailItem[];
}

export async function getPODetail(poId: string): Promise<{ ok: boolean; data?: PODetailData; error?: string }> {
  await requireUser();
  const { rows: oRows } = await query<{
    id: string; code: string; supplier_id: string; supplier_name: string; supplier_code: string;
    so_id: string | null; so_code: string | null;
    order_date: string; expected_arrival_date: string | null;
    fx_rate: number; subtotal_cny: number; shipping_cny: number;
    total_cny: number; total_vnd: number; paid_cny: number;
    status: string; payment_status: string; notes: string | null;
    created_by_name: string | null;
  }>(
    `SELECT po.*,
            COALESCE(s.name,'—') AS supplier_name, COALESCE(s.code,'') AS supplier_code,
            cb.full_name AS created_by_name
     FROM purchase_orders po
     LEFT JOIN suppliers s ON po.supplier_id = s.id
     LEFT JOIN profiles  cb ON po.created_by = cb.id
     WHERE po.id = ? LIMIT 1`,
    [poId],
  );
  if (!oRows[0]) return { ok: false, error: 'Không tìm thấy PO' };
  const o = oRows[0];

  const { rows: items } = await query<{
    id: string; product_id: string; product_name_snapshot: string;
    quantity: number; received_qty: number; unit_cost_cny: number; line_total_cny: number;
    so_id: string | null; so_code: string | null;
  }>(`SELECT id, product_id, product_name_snapshot, quantity, received_qty,
             unit_cost_cny, line_total_cny, so_id, so_code
      FROM purchase_order_items WHERE po_id = ? ORDER BY sort_order`, [poId]);

  return {
    ok: true,
    data: {
      id: o.id, code: o.code, supplier_id: o.supplier_id,
      supplier_name: o.supplier_name, supplier_code: o.supplier_code,
      so_id: o.so_id, so_code: o.so_code,
      order_date: o.order_date, expected_arrival_date: o.expected_arrival_date,
      fx_rate: Number(o.fx_rate),
      subtotal_cny: Number(o.subtotal_cny), shipping_cny: Number(o.shipping_cny),
      total_cny: Number(o.total_cny), total_vnd: Number(o.total_vnd),
      paid_cny: Number(o.paid_cny),
      status: o.status, payment_status: o.payment_status, notes: o.notes,
      created_by_name: o.created_by_name,
      items: items.map((r) => ({
        id: r.id, product_id: r.product_id, product_name: r.product_name_snapshot,
        quantity: Number(r.quantity), received_qty: Number(r.received_qty),
        unit_cost_cny: Number(r.unit_cost_cny), line_total_cny: Number(r.line_total_cny),
        so_id: r.so_id, so_code: r.so_code,
      })),
    },
  };
}

/** Gắn/bỏ SO cho từng dòng hàng trong PO. */
export async function updatePOItemSOLink(
  itemId: string,
  soId: string | null,
  soCode: string | null,
): Promise<ActionResult> {
  await requireUser();
  await query(
    'UPDATE purchase_order_items SET so_id = ?, so_code = ? WHERE id = ?',
    [soId || null, soCode || null, itemId],
  );
  revalidatePath('/purchase-orders');
  return { ok: true };
}

/**
 * Ghi nhận thanh toán tiền hàng cho NCC — cộng vào paid_cny.
 */
export async function recordPOPayment(
  id: string,
  amountCny: number,
): Promise<ActionResult> {
  await requireUser();

  const { rows } = await query<{ total_cny: number; paid_cny: number }>(
    'SELECT total_cny, paid_cny FROM purchase_orders WHERE id = ? LIMIT 1',
    [id],
  );

  if (!rows[0]) return { ok: false, error: 'Không tìm thấy PO' };

  const newPaid = Number(rows[0].paid_cny) + amountCny;
  const total = Number(rows[0].total_cny);
  let paymentStatus: string;
  if (newPaid >= total) paymentStatus = 'paid';
  else if (newPaid > 0) paymentStatus = 'partial';
  else paymentStatus = 'unpaid';

  await query(
    'UPDATE purchase_orders SET paid_cny = ?, payment_status = ? WHERE id = ?',
    [newPaid, paymentStatus, id],
  );

  revalidatePath('/purchase-orders');
  return { ok: true };
}
