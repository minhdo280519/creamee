'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { generateCode } from '@/lib/db/helpers';
import type { ActionResult } from '@/app/(app)/customers/actions';
import type { SampleStatus } from '@/lib/types';
export type { SampleStatus };

export interface CreateSampleDraft {
  customer_id: string;
  product_id?: string;
  product_name: string;
  supplier_id?: string;
  deposit_amount: number;
  deposit_paid: number;
  goods_cost_cny: number;
  goods_cost_vnd: number;
  ship_cost_vnd: number;
  sample_fee_vnd: number;
  other_cost_vnd: number;
  fx_rate: number;
  notes?: string;
}

export interface UpdateSampleDraft extends Partial<CreateSampleDraft> {
  id: string;
  status?: SampleStatus;
  refund_amount?: number;
  cumulative_qty_ordered?: number;
}

export async function createSample(
  draft: CreateSampleDraft,
): Promise<ActionResult<{ id: string; code: string }>> {
  const profile = await requireUser();

  if (!draft.customer_id) return { ok: false, error: 'Vui lòng chọn khách hàng' };
  if (!draft.product_name.trim()) return { ok: false, error: 'Vui lòng nhập tên sản phẩm mẫu' };

  const code = await generateCode('MAU');
  const id = crypto.randomUUID();

  const { affectedRows } = await query(
    `INSERT INTO samples
     (id, code, customer_id, product_id, product_name, supplier_id,
      status, deposit_amount, deposit_paid, refund_amount,
      goods_cost_cny, goods_cost_vnd, ship_cost_vnd, sample_fee_vnd,
      other_cost_vnd, fx_rate, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, code, draft.customer_id,
      draft.product_id || null, draft.product_name,
      draft.supplier_id || null,
      draft.deposit_amount, draft.deposit_paid,
      draft.goods_cost_cny, draft.goods_cost_vnd,
      draft.ship_cost_vnd, draft.sample_fee_vnd,
      draft.other_cost_vnd, draft.fx_rate,
      draft.notes || null, profile.id,
    ],
  );

  if (affectedRows === 0) return { ok: false, error: 'Không tạo được mẫu' };

  revalidatePath('/samples');
  return { ok: true, data: { id, code } };
}

export async function updateSample(
  draft: UpdateSampleDraft,
): Promise<ActionResult> {
  await requireUser();

  const sets: string[] = [];
  const vals: unknown[] = [];

  if (draft.status !== undefined) { sets.push('status = ?'); vals.push(draft.status); }
  if (draft.deposit_paid !== undefined) { sets.push('deposit_paid = ?'); vals.push(draft.deposit_paid); }
  if (draft.refund_amount !== undefined) { sets.push('refund_amount = ?'); vals.push(draft.refund_amount); }
  if (draft.cumulative_qty_ordered !== undefined) { sets.push('cumulative_qty_ordered = ?'); vals.push(draft.cumulative_qty_ordered); }
  if (draft.goods_cost_cny !== undefined) { sets.push('goods_cost_cny = ?'); vals.push(draft.goods_cost_cny); }
  if (draft.goods_cost_vnd !== undefined) { sets.push('goods_cost_vnd = ?'); vals.push(draft.goods_cost_vnd); }
  if (draft.ship_cost_vnd !== undefined) { sets.push('ship_cost_vnd = ?'); vals.push(draft.ship_cost_vnd); }
  if (draft.sample_fee_vnd !== undefined) { sets.push('sample_fee_vnd = ?'); vals.push(draft.sample_fee_vnd); }
  if (draft.other_cost_vnd !== undefined) { sets.push('other_cost_vnd = ?'); vals.push(draft.other_cost_vnd); }
  if (draft.fx_rate !== undefined) { sets.push('fx_rate = ?'); vals.push(draft.fx_rate); }
  if (draft.notes !== undefined) { sets.push('notes = ?'); vals.push(draft.notes || null); }
  if (draft.product_name !== undefined) { sets.push('product_name = ?'); vals.push(draft.product_name); }
  if (draft.supplier_id !== undefined) { sets.push('supplier_id = ?'); vals.push(draft.supplier_id || null); }

  if (sets.length === 0) return { ok: false, error: 'Không có gì để cập nhật' };

  vals.push(draft.id);
  await query(`UPDATE samples SET ${sets.join(', ')} WHERE id = ?`, vals);

  revalidatePath('/samples');
  return { ok: true };
}
