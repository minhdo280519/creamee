'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { generateCode } from '@/lib/db/helpers';
import { canApproveCash, type Role } from '@/lib/roles';
import type { ActionResult } from '@/app/(app)/customers/actions';

export interface CashDraft {
  transaction_type: 'income' | 'expense';
  amount_vnd: number;
  category: string;
  transaction_date: string;
  description: string;
  customer_id?: string;
  supplier_id?: string;
  payment_method: string;
  reference_type?: string;
  reference_code?: string;
}

/** Đồng bộ paid_amount và payment_status của SO từ các phiếu thu đã duyệt. */
async function syncSOPayment(soCode: string) {
  const { rows } = await query<{ total_paid: number; total: number }>(
    `SELECT so.total,
            COALESCE((SELECT SUM(ct.amount_vnd) FROM cash_transactions ct
                      WHERE ct.reference_type = 'sales_order'
                        AND ct.reference_code = so.code
                        AND ct.transaction_type = 'income'
                        AND ct.status = 'approved'), 0) AS total_paid
     FROM sales_orders so WHERE so.code = ? LIMIT 1`,
    [soCode],
  );
  if (!rows[0]) return;
  const total = Number(rows[0].total);
  const paid = Number(rows[0].total_paid);
  let payStatus: string;
  if (paid <= 0) payStatus = 'unpaid';
  else if (paid >= total) payStatus = 'paid';
  else payStatus = 'partial';

  await query(
    `UPDATE sales_orders SET paid_amount = ?, payment_status = ? WHERE code = ?`,
    [paid, payStatus, soCode],
  );
  revalidatePath('/sales-orders');
}

/** Đồng bộ paid_cny và payment_status của PO từ các phiếu chi đã duyệt. */
async function syncPOPayment(poCode: string) {
  const { rows } = await query<{ total_cny: number; fx_rate: number; total_paid_vnd: number }>(
    `SELECT po.total_cny, po.fx_rate,
            COALESCE((SELECT SUM(ct.amount_vnd) FROM cash_transactions ct
                      WHERE ct.reference_type = 'purchase_order'
                        AND ct.reference_code = po.code
                        AND ct.transaction_type = 'expense'
                        AND ct.status = 'approved'), 0) AS total_paid_vnd
     FROM purchase_orders po WHERE po.code = ? LIMIT 1`,
    [poCode],
  );
  if (!rows[0]) return;
  const totalCny = Number(rows[0].total_cny);
  const fxRate = Number(rows[0].fx_rate) || 1;
  const paidCny = Number(rows[0].total_paid_vnd) / fxRate;
  let payStatus: string;
  if (paidCny <= 0) payStatus = 'unpaid';
  else if (paidCny >= totalCny) payStatus = 'paid';
  else payStatus = 'partial';

  await query(
    `UPDATE purchase_orders SET paid_cny = ?, payment_status = ? WHERE code = ?`,
    [paidCny, payStatus, poCode],
  );
  revalidatePath('/purchase-orders');
}

/**
 * Tạo giao dịch tiền. Chủ + Kế toán trưởng: tự duyệt luôn.
 * Kế toán viên: tạo ở trạng thái 'pending' chờ duyệt.
 */
export async function createCashTransaction(
  draft: CashDraft,
): Promise<ActionResult<{ id: string }>> {
  const profile = await requireUser();

  if (draft.amount_vnd <= 0) return { ok: false, error: 'Số tiền phải lớn hơn 0' };
  if (!draft.category) return { ok: false, error: 'Vui lòng chọn hạng mục' };

  const selfApprove = canApproveCash(profile.role as Role);
  const status = selfApprove ? 'approved' : 'pending';
  const prefix = draft.transaction_type === 'income' ? 'THU' : 'CHI';
  const code = await generateCode(prefix);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const refType = draft.reference_type || null;
  const refCode = draft.reference_code?.trim() || null;

  await query(
    `INSERT INTO cash_transactions
     (id, code, transaction_type, amount_vnd, category, transaction_date,
      description, customer_id, supplier_id, payment_method, status,
      reference_type, reference_code,
      created_by, approved_by, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, code, draft.transaction_type, draft.amount_vnd, draft.category,
      draft.transaction_date, draft.description || null,
      draft.customer_id || null, draft.supplier_id || null,
      draft.payment_method || 'cash', status,
      refType, refCode,
      profile.id,
      selfApprove ? profile.id : null,
      selfApprove ? now : null,
    ],
  );

  if (selfApprove && refCode) {
    if (refType === 'sales_order') await syncSOPayment(refCode);
    if (refType === 'purchase_order') await syncPOPayment(refCode);
  }

  if (!selfApprove) {
    await query(
      `INSERT INTO approvals
       (id, entity_type, entity_id, entity_code, reason, amount, requested_by, status)
       VALUES (UUID(), 'cash_transaction', ?, ?, 'Giao dịch tiền cần duyệt', ?, ?, 'pending')`,
      [id, code, draft.amount_vnd, profile.id],
    );
  }

  revalidatePath('/cash');
  return { ok: true, data: { id } };
}

/** Duyệt giao dịch tiền. */
export async function approveCashTransaction(id: string): Promise<ActionResult> {
  const profile = await requireUser();
  if (!canApproveCash(profile.role as Role)) {
    return { ok: false, error: 'Bạn không có quyền duyệt giao dịch tiền' };
  }

  const { rows: ctRows } = await query<{ reference_type: string | null; reference_code: string | null }>(
    'SELECT reference_type, reference_code FROM cash_transactions WHERE id = ? LIMIT 1',
    [id],
  );

  const now = new Date().toISOString();
  await query(
    `UPDATE cash_transactions
     SET status = 'approved', approved_by = ?, approved_at = ?
     WHERE id = ?`,
    [profile.id, now, id],
  );
  await query(
    `UPDATE approvals
     SET status = 'approved', decided_by = ?, decided_at = ?
     WHERE entity_type = 'cash_transaction' AND entity_id = ? AND status = 'pending'`,
    [profile.id, now, id],
  );

  const ct = ctRows[0];
  if (ct?.reference_code) {
    if (ct.reference_type === 'sales_order') await syncSOPayment(ct.reference_code);
    if (ct.reference_type === 'purchase_order') await syncPOPayment(ct.reference_code);
  }

  revalidatePath('/cash');
  return { ok: true };
}

/** Từ chối giao dịch tiền. */
export async function rejectCashTransaction(
  id: string,
  reason: string,
): Promise<ActionResult> {
  const profile = await requireUser();
  if (!canApproveCash(profile.role as Role)) {
    return { ok: false, error: 'Bạn không có quyền từ chối giao dịch' };
  }

  const now = new Date().toISOString();
  await query(
    "UPDATE cash_transactions SET status = 'rejected' WHERE id = ?",
    [id],
  );
  await query(
    `UPDATE approvals
     SET status = 'rejected', decided_by = ?, decided_at = ?, decision_notes = ?
     WHERE entity_type = 'cash_transaction' AND entity_id = ? AND status = 'pending'`,
    [profile.id, now, reason, id],
  );

  revalidatePath('/cash');
  return { ok: true };
}
