'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { generateCode } from '@/lib/db/helpers';
import type { ActionResult } from '@/app/(app)/customers/actions';

export type DealStage =
  | 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

/** Tạo cơ hội bán hàng mới. */
export async function createDeal(values: {
  title: string;
  customer_id?: string;
  customer_name_snapshot?: string;
  estimated_value: number;
  expected_close_date?: string;
  source?: string;
  next_action?: string;
}): Promise<ActionResult<{ id: string }>> {
  const profile = await requireUser();

  if (!values.title.trim()) {
    return { ok: false, error: 'Vui lòng nhập tên cơ hội' };
  }

  const code = await generateCode('DEAL');
  const id = crypto.randomUUID();

  await query(
    `INSERT INTO deals
     (id, code, title, customer_id, customer_name_snapshot, stage,
      estimated_value, probability_pct, expected_close_date, source,
      next_action, assigned_to, created_by)
     VALUES (?, ?, ?, ?, ?, 'new', ?, 50, ?, ?, ?, ?, ?)`,
    [
      id, code, values.title,
      values.customer_id || null,
      values.customer_name_snapshot || null,
      values.estimated_value || 0,
      values.expected_close_date || null,
      values.source || null,
      values.next_action || null,
      profile.id,
      profile.id,
    ],
  );

  revalidatePath('/deals');
  return { ok: true, data: { id } };
}

/**
 * Chuyển stage của deal (kéo-thả Kanban).
 */
export async function moveDealStage(
  id: string,
  stage: DealStage,
): Promise<ActionResult> {
  await requireUser();

  const probByStage: Record<DealStage, number> = {
    new: 10, qualified: 30, proposal: 50,
    negotiation: 75, won: 100, lost: 0,
  };

  const isClosing = stage === 'won' || stage === 'lost';
  const closeDate = isClosing ? new Date().toISOString().slice(0, 10) : null;

  await query(
    `UPDATE deals SET stage = ?, probability_pct = ?, actual_close_date = ?
     WHERE id = ?`,
    [stage, probByStage[stage], closeDate, id],
  );

  revalidatePath('/deals');
  return { ok: true };
}

/** Cập nhật thông tin deal. */
export async function updateDeal(
  id: string,
  values: Record<string, unknown>,
): Promise<ActionResult> {
  await requireUser();

  await query(
    `UPDATE deals SET
       title = ?, estimated_value = ?, expected_close_date = ?,
       next_action = ?, next_action_date = ?, notes = ?
     WHERE id = ?`,
    [
      values.title,
      Number(values.estimated_value) || 0,
      values.expected_close_date || null,
      values.next_action || null,
      values.next_action_date || null,
      values.notes || null,
      id,
    ],
  );

  revalidatePath('/deals');
  return { ok: true };
}
