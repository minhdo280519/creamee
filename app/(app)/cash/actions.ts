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

  await query(
    `INSERT INTO cash_transactions
     (id, code, transaction_type, amount_vnd, category, transaction_date,
      description, customer_id, supplier_id, payment_method, status,
      created_by, approved_by, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, code, draft.transaction_type, draft.amount_vnd, draft.category,
      draft.transaction_date, draft.description || null,
      draft.customer_id || null, draft.supplier_id || null,
      draft.payment_method || 'cash', status, profile.id,
      selfApprove ? profile.id : null,
      selfApprove ? now : null,
    ],
  );

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
