'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { generateCode, suggestFifoAllocation, deliverOrderWithAllocation, restoreLotsForOrder } from '@/lib/db/helpers';
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
}

export interface AllocLine {
  lot_id: string | null;
  lot_code: string;
  qty: number;
  goods_unit_cost: number;
  ship_unit_cost: number;
  is_negative: boolean;
}
export interface ItemAllocation {
  order_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  lines: AllocLine[];
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
      subtotal, discount_amount, shipping_fee, total, status, payment_status,
      notes, created_by, approved_by, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?)`,
    [
      id, code, draft.customer_id, draft.order_date,
      draft.delivery_date || null, draft.delivery_address || null,
      totals.subTotal, totals.discountAmount, draft.shipping_fee, totals.total,
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

/**
 * Lấy gợi ý phân bổ FIFO cho toàn đơn.
 */
export async function getFifoSuggestion(
  orderId: string,
): Promise<{ ok: boolean; error?: string; items?: ItemAllocation[] }> {
  await requireUser();

  const { rows: items } = await query<{
    id: string; product_id: string; product_name_snapshot: string; quantity: number;
  }>(
    'SELECT id, product_id, product_name_snapshot, quantity FROM sales_order_items WHERE order_id = ?',
    [orderId],
  );

  if (!items || items.length === 0) {
    return { ok: false, error: 'Đơn không có sản phẩm' };
  }

  const result: ItemAllocation[] = [];
  for (const it of items) {
    const alloc = await suggestFifoAllocation(it.product_id, it.quantity);
    result.push({
      order_item_id: it.id,
      product_id: it.product_id,
      product_name: it.product_name_snapshot,
      quantity: it.quantity,
      lines: alloc,
    });
  }

  return { ok: true, items: result };
}

/**
 * Giao hàng — xuất kho theo phân bổ đã xác nhận.
 */
export async function deliverOrder(
  orderId: string,
  allocation: ItemAllocation[],
): Promise<ActionResult> {
  await requireUser();

  try {
    await deliverOrderWithAllocation(orderId, allocation);
  } catch (err) {
    return { ok: false, error: `Xuất kho thất bại: ${err instanceof Error ? err.message : String(err)}` };
  }

  revalidatePath('/sales-orders');
  revalidatePath(`/sales-orders/${orderId}`);
  revalidatePath('/products');
  revalidatePath('/inventory-lots');
  return { ok: true };
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
