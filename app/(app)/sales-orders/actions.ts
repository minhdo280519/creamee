'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { generateCode, restoreLotsForOrder } from '@/lib/db/helpers';
import { canApproveOrder, type Role } from '@/lib/roles';
import {
  calcOrderTotal, checkApprovalNeeded, checkCreditLimit,
  type OrderLineInput,
} from '@/lib/business-logic';
import type { ActionResult } from '@/app/(app)/customers/actions';

export interface SOLineDraft {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
}

export interface CreateSODraft {
  customer_id: string;
  order_date: string;
  delivery_date?: string;
  delivery_address?: string;
  notes?: string;
  items: SOLineDraft[];
  order_discount_value: number;
  order_discount_type: 'percent' | 'fixed';
  shipping_fee: number;
  deposit_amount?: number;
}

export interface UpdateSODraft {
  order_id: string;
  delivery_date?: string;
  delivery_address?: string;
  notes?: string;
  items: SOLineDraft[];
  order_discount_value: number;
  order_discount_type: 'percent' | 'fixed';
  shipping_fee: number;
  deposit_amount?: number;
}

export interface SODeliveryItem {
  item_id: string;
  product_name: string;
  quantity: number;
  delivered_qty: number;
}

export interface DeliveryLine {
  item_id: string;
  qty_now: number;
}

/**
 * Tạo đơn bán — multi-line.
 */
export async function createSalesOrder(
  draft: CreateSODraft,
): Promise<ActionResult<{ id: string; code: string }>> {
  const profile = await requireUser();

  if (!draft.customer_id) return { ok: false, error: 'Vui lòng chọn khách hàng' };
  if (draft.items.length === 0) return { ok: false, error: 'Đơn cần ít nhất 1 sản phẩm' };
  for (const [i, it] of draft.items.entries()) {
    if (!it.product_id) return { ok: false, error: `Dòng ${i + 1}: chưa chọn sản phẩm` };
    if (it.quantity <= 0) return { ok: false, error: `Dòng ${i + 1}: số lượng phải > 0` };
    if (it.unit_price <= 0) return { ok: false, error: `Dòng ${i + 1}: đơn giá phải > 0` };
  }

  const lines: OrderLineInput[] = draft.items.map((it) => ({
    qtyOrdered: it.quantity,
    unitPrice: it.unit_price,
    lineDiscountPercent: it.discount_pct / 100,
  }));
  const totals = calcOrderTotal(
    lines,
    { value: draft.order_discount_value, type: draft.order_discount_type },
    draft.shipping_fee,
  );

  // Kiểm tra hạn mức công nợ.
  const { rows: custRows } = await query<{ credit_limit: number }>(
    'SELECT credit_limit FROM customers WHERE id = ? LIMIT 1',
    [draft.customer_id],
  );
  const customer = custRows[0];
  if (customer && customer.credit_limit > 0) {
    const { rows: arRows } = await query<{ outstanding: number }>(
      `SELECT (total - paid_amount) AS outstanding
       FROM sales_orders
       WHERE customer_id = ? AND payment_status != 'paid' AND status != 'cancelled'`,
      [draft.customer_id],
    );
    const currentDebt = arRows.reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
    const credit = checkCreditLimit(customer.credit_limit, currentDebt, totals.total);
    const role = profile.role as Role;
    if (!credit.ok && role === 'sales') {
      return { ok: false, error: credit.message };
    }
  }

  const needsApproval = checkApprovalNeeded(totals.total);
  const status = needsApproval ? 'pending_approval' : 'approved';
  const code = await generateCode('SO');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { affectedRows } = await query(
    `INSERT INTO sales_orders
     (id, code, customer_id, order_date, delivery_date, delivery_address,
      subtotal, discount_amount, shipping_fee, total, deposit_amount,
      status, payment_status, notes, created_by, approved_by, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?)`,
    [
      id, code, draft.customer_id, draft.order_date,
      draft.delivery_date || null, draft.delivery_address || null,
      totals.subTotal, totals.discountAmount, draft.shipping_fee, totals.total,
      draft.deposit_amount ?? 0,
      status, draft.notes || null, profile.id,
      needsApproval ? null : profile.id,
      needsApproval ? null : now,
    ],
  );

  if (affectedRows === 0) return { ok: false, error: 'Không tạo được đơn' };

  for (const [idx, it] of draft.items.entries()) {
    const lineTotal = it.quantity * it.unit_price * (1 - it.discount_pct / 100);
    await query(
      `INSERT INTO sales_order_items
       (id, order_id, product_id, product_name_snapshot, quantity,
        unit_price, discount_pct, line_total, sort_order)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, it.product_id, it.product_name, it.quantity,
       it.unit_price, it.discount_pct, Math.round(lineTotal), idx],
    );
  }

  if (needsApproval) {
    await query(
      `INSERT INTO approvals
       (id, entity_type, entity_id, entity_code, reason, amount, requested_by, status)
       VALUES (UUID(), 'sales_order', ?, ?, 'Đơn vượt ngưỡng cần duyệt', ?, ?, 'pending')`,
      [id, code, totals.total, profile.id],
    );
  }

  revalidatePath('/sales-orders');
  return { ok: true, data: { id, code } };
}

/** Duyệt đơn bán. */
export async function approveSalesOrder(orderId: string): Promise<ActionResult> {
  const profile = await requireUser();
  if (!canApproveOrder(profile.role as Role)) {
    return { ok: false, error: 'Bạn không có quyền duyệt đơn' };
  }

  const now = new Date().toISOString();
  await query(
    `UPDATE sales_orders
     SET status = 'approved', approved_by = ?, approved_at = ?
     WHERE id = ?`,
    [profile.id, now, orderId],
  );
  await query(
    `UPDATE approvals
     SET status = 'approved', decided_by = ?, decided_at = ?
     WHERE entity_type = 'sales_order' AND entity_id = ? AND status = 'pending'`,
    [profile.id, now, orderId],
  );

  revalidatePath('/sales-orders');
  revalidatePath(`/sales-orders/${orderId}`);
  return { ok: true };
}

/** Lấy danh sách sản phẩm trong SO để giao hàng. */
export async function getSOItemsForDelivery(orderId: string): Promise<{
  ok: boolean;
  items?: SODeliveryItem[];
  error?: string;
}> {
  await requireUser();
  const { rows } = await query<{
    id: string; product_name_snapshot: string; quantity: number; delivered_qty: number;
  }>(
    `SELECT id, product_name_snapshot, quantity, delivered_qty
     FROM sales_order_items WHERE order_id = ? ORDER BY sort_order`,
    [orderId],
  );
  return {
    ok: true,
    items: rows.map((r) => ({
      item_id: r.id,
      product_name: r.product_name_snapshot,
      quantity: Number(r.quantity),
      delivered_qty: Number(r.delivered_qty),
    })),
  };
}

/** Cập nhật số lượng đã giao cho từng sản phẩm trong SO. */
export async function markDelivered(
  orderId: string,
  lines: DeliveryLine[],
): Promise<ActionResult> {
  await requireUser();

  const toDeliver = lines.filter((l) => l.qty_now > 0);
  if (toDeliver.length === 0) return { ok: false, error: 'Không có sản phẩm nào được giao' };

  for (const l of toDeliver) {
    await query(
      `UPDATE sales_order_items
       SET delivered_qty = delivered_qty + ?
       WHERE id = ? AND order_id = ?`,
      [l.qty_now, l.item_id, orderId],
    );
  }

  const { rows } = await query<{ quantity: number; delivered_qty: number }>(
    'SELECT quantity, delivered_qty FROM sales_order_items WHERE order_id = ?',
    [orderId],
  );

  const allDelivered = rows.every((r) => Number(r.delivered_qty) >= Number(r.quantity));
  const anyDelivered = rows.some((r) => Number(r.delivered_qty) > 0);
  const newStatus = allDelivered ? 'delivered' : anyDelivered ? 'partial_delivered' : 'approved';

  await query('UPDATE sales_orders SET status = ? WHERE id = ?', [newStatus, orderId]);

  revalidatePath('/sales-orders');
  revalidatePath('/warehouse');
  return { ok: true };
}

/** Lấy dòng hàng của đơn để hiển thị form sửa. */
export async function getSalesOrderItems(orderId: string): Promise<{
  ok: boolean;
  items?: { product_id: string; product_name: string; quantity: number; unit_price: number; discount_pct: number }[];
  error?: string;
}> {
  await requireUser();
  const { rows } = await query<{
    product_id: string; product_name_snapshot: string; quantity: number;
    unit_price: number; discount_pct: number;
  }>(
    `SELECT product_id, product_name_snapshot, quantity, unit_price, discount_pct
     FROM sales_order_items WHERE order_id = ? ORDER BY sort_order`,
    [orderId],
  );
  return {
    ok: true,
    items: rows.map((r) => ({
      product_id: r.product_id,
      product_name: r.product_name_snapshot,
      quantity: r.quantity,
      unit_price: r.unit_price,
      discount_pct: r.discount_pct,
    })),
  };
}

// ── SO Detail ──────────────────────────────────────────────────────────────

export interface SODetailItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  line_total: number;
  delivered_qty: number;
}

export interface SODetailData {
  id: string; code: string;
  customer_name: string; customer_code: string; customer_id: string;
  order_date: string; delivery_date: string | null; delivery_address: string | null; notes: string | null;
  subtotal: number; discount_amount: number; shipping_fee: number;
  total: number; paid_amount: number; deposit_amount: number;
  status: string; payment_status: string;
  created_by_name: string | null; approved_by_name: string | null;
  items: SODetailItem[];
  relatedPOs: { id: string; code: string; supplier_name: string | null; status: string; total_vnd: number; order_date: string }[];
  cashPaid: number;
}

export async function getSODetail(orderId: string): Promise<{ ok: boolean; data?: SODetailData; error?: string }> {
  await requireUser();
  const { rows: oRows } = await query<{
    id: string; code: string; customer_id: string; customer_name: string; customer_code: string;
    order_date: string; delivery_date: string | null; delivery_address: string | null; notes: string | null;
    subtotal: number; discount_amount: number; shipping_fee: number;
    total: number; paid_amount: number; deposit_amount: number;
    status: string; payment_status: string;
    created_by_name: string | null; approved_by_name: string | null;
  }>(
    `SELECT so.*,
            COALESCE(c.name,'—') AS customer_name, COALESCE(c.code,'') AS customer_code,
            cb.full_name AS created_by_name, ab.full_name AS approved_by_name
     FROM sales_orders so
     LEFT JOIN customers c  ON so.customer_id = c.id
     LEFT JOIN profiles  cb ON so.created_by = cb.id
     LEFT JOIN profiles  ab ON so.approved_by = ab.id
     WHERE so.id = ? LIMIT 1`,
    [orderId],
  );
  if (!oRows[0]) return { ok: false, error: 'Không tìm thấy đơn' };
  const o = oRows[0];

  const { rows: items } = await query<{
    id: string; product_name_snapshot: string; quantity: number;
    unit_price: number; discount_pct: number; line_total: number; delivered_qty: number;
  }>(`SELECT id, product_name_snapshot, quantity, unit_price, discount_pct, line_total, delivered_qty
      FROM sales_order_items WHERE order_id = ? ORDER BY sort_order`, [orderId]);

  const { rows: poRows } = await query<{
    id: string; code: string; supplier_name: string | null; status: string; total_vnd: number; order_date: string;
  }>(`SELECT po.id, po.code, s.name AS supplier_name, po.status, po.total_vnd, po.order_date
      FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.so_id = ? OR po.so_code = ? ORDER BY po.order_date DESC`, [orderId, o.code]);

  const { rows: cashRows } = await query<{ total_paid: number }>(
    `SELECT COALESCE(SUM(amount_vnd),0) AS total_paid FROM cash_transactions
     WHERE reference_type='sales_order' AND reference_code=? AND transaction_type='income' AND status='approved'`,
    [o.code],
  );

  return {
    ok: true,
    data: {
      id: o.id, code: o.code, customer_id: o.customer_id,
      customer_name: o.customer_name, customer_code: o.customer_code,
      order_date: o.order_date, delivery_date: o.delivery_date,
      delivery_address: o.delivery_address, notes: o.notes,
      subtotal: Number(o.subtotal), discount_amount: Number(o.discount_amount),
      shipping_fee: Number(o.shipping_fee), total: Number(o.total),
      paid_amount: Number(o.paid_amount), deposit_amount: Number(o.deposit_amount),
      status: o.status, payment_status: o.payment_status,
      created_by_name: o.created_by_name, approved_by_name: o.approved_by_name,
      items: items.map((r) => ({
        id: r.id, product_name: r.product_name_snapshot,
        quantity: Number(r.quantity), unit_price: Number(r.unit_price),
        discount_pct: Number(r.discount_pct), line_total: Number(r.line_total),
        delivered_qty: Number(r.delivered_qty),
      })),
      relatedPOs: poRows.map((r) => ({
        id: r.id, code: r.code, supplier_name: r.supplier_name,
        status: r.status, total_vnd: Number(r.total_vnd), order_date: r.order_date,
      })),
      cashPaid: Number(cashRows[0]?.total_paid ?? 0),
    },
  };
}

/** Từ chối đơn bán. */
export async function rejectSalesOrder(
  orderId: string,
  reason: string,
): Promise<ActionResult> {
  const profile = await requireUser();
  if (!canApproveOrder(profile.role as Role)) {
    return { ok: false, error: 'Bạn không có quyền từ chối đơn' };
  }

  const now = new Date().toISOString();
  await query("UPDATE sales_orders SET status = 'cancelled' WHERE id = ?", [orderId]);
  await query(
    `UPDATE approvals
     SET status = 'rejected', decided_by = ?, decided_at = ?, decision_notes = ?
     WHERE entity_type = 'sales_order' AND entity_id = ? AND status = 'pending'`,
    [profile.id, now, reason, orderId],
  );

  revalidatePath('/sales-orders');
  return { ok: true };
}

/** Cập nhật đơn bán (sửa dòng hàng, giá, tiền cọc). */
export async function updateSalesOrder(
  draft: UpdateSODraft,
): Promise<ActionResult> {
  await requireUser();

  const { rows: soRows } = await query<{ status: string }>(
    'SELECT status FROM sales_orders WHERE id = ? LIMIT 1',
    [draft.order_id],
  );
  const current = soRows[0];
  if (!current) return { ok: false, error: 'Không tìm thấy đơn' };
  if (['completed', 'cancelled'].includes(current.status)) {
    return { ok: false, error: 'Không thể sửa đơn đã hoàn thành hoặc đã huỷ' };
  }

  if (draft.items.length === 0) return { ok: false, error: 'Đơn cần ít nhất 1 sản phẩm' };
  for (const [i, it] of draft.items.entries()) {
    if (!it.product_id) return { ok: false, error: `Dòng ${i + 1}: chưa chọn sản phẩm` };
    if (it.quantity <= 0) return { ok: false, error: `Dòng ${i + 1}: số lượng phải > 0` };
    if (it.unit_price <= 0) return { ok: false, error: `Dòng ${i + 1}: đơn giá phải > 0` };
  }

  const lines: OrderLineInput[] = draft.items.map((it) => ({
    qtyOrdered: it.quantity,
    unitPrice: it.unit_price,
    lineDiscountPercent: it.discount_pct / 100,
  }));
  const totals = calcOrderTotal(
    lines,
    { value: draft.order_discount_value, type: draft.order_discount_type },
    draft.shipping_fee,
  );

  await query(
    `UPDATE sales_orders SET
       delivery_date = ?, delivery_address = ?, notes = ?,
       subtotal = ?, discount_amount = ?, shipping_fee = ?,
       total = ?, deposit_amount = ?
     WHERE id = ?`,
    [
      draft.delivery_date || null, draft.delivery_address || null, draft.notes || null,
      totals.subTotal, totals.discountAmount, draft.shipping_fee,
      totals.total, draft.deposit_amount ?? 0,
      draft.order_id,
    ],
  );

  await query('DELETE FROM sales_order_items WHERE order_id = ?', [draft.order_id]);
  for (const [idx, it] of draft.items.entries()) {
    const lineTotal = it.quantity * it.unit_price * (1 - it.discount_pct / 100);
    await query(
      `INSERT INTO sales_order_items
       (id, order_id, product_id, product_name_snapshot, quantity,
        unit_price, discount_pct, line_total, sort_order)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [draft.order_id, it.product_id, it.product_name, it.quantity,
       it.unit_price, it.discount_pct, Math.round(lineTotal), idx],
    );
  }

  revalidatePath('/sales-orders');
  return { ok: true };
}

/** Cập nhật trạng thái đơn. */
export async function updateOrderStatus(
  orderId: string,
  status: string,
): Promise<ActionResult> {
  await requireUser();

  if (status === 'cancelled') {
    const { rows } = await query<{ status: string }>(
      'SELECT status FROM sales_orders WHERE id = ? LIMIT 1',
      [orderId],
    );
    const current = rows[0]?.status;
    if (current && ['delivered', 'partial_delivered', 'completed'].includes(current)) {
      try {
        await restoreLotsForOrder(orderId);
      } catch (err) {
        return { ok: false, error: `Không hoàn kho được: ${err instanceof Error ? err.message : String(err)}` };
      }
      revalidatePath('/products');
    }
  }

  await query('UPDATE sales_orders SET status = ? WHERE id = ?', [status, orderId]);

  revalidatePath('/sales-orders');
  revalidatePath(`/sales-orders/${orderId}`);
  return { ok: true };
}
