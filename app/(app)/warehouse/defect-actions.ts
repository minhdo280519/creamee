'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import type { ActionResult } from '@/app/(app)/customers/actions';
import type { Defect, DefectHandlingMethod, DefectWithContext } from '@/lib/types';

// ── Lưu kết quả QC + defects cho một PO item ────────────────

export interface QCInput {
  po_item_id: string;
  po_id: string;
  product_id: string;
  variant_id?: string | null;
  qty_reported: number;
  qty_actual_received: number;
  qty_good: number;
  qc_notes?: string;
  defects: {
    defect_reason: string;
    quantity: number;
    handling_method: DefectHandlingMethod;
    handling_notes?: string;
    loss_vnd?: number;
  }[];
}

export async function saveQCResult(input: QCInput): Promise<ActionResult> {
  const profile = await requireUser();

  // Cập nhật QC columns trên po_item
  await query(
    `UPDATE purchase_order_items SET
       qty_reported        = ?,
       qty_actual_received = ?,
       qty_good            = ?,
       received_qty        = ?,
       qc_notes            = ?,
       qc_done_at          = NOW()
     WHERE id = ?`,
    [
      input.qty_reported,
      input.qty_actual_received,
      input.qty_good,
      input.qty_good, // received_qty = good
      input.qc_notes || null,
      input.po_item_id,
    ],
  );

  // Insert defect records
  for (const d of input.defects) {
    if (d.quantity <= 0) continue;
    await query(
      `INSERT INTO defects
       (id, po_id, po_item_id, product_id, variant_id,
        defect_reason, quantity, handling_method, handling_notes, loss_vnd, created_by)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.po_id, input.po_item_id, input.product_id,
        input.variant_id ?? null,
        d.defect_reason, d.quantity, d.handling_method,
        d.handling_notes || null,
        d.loss_vnd || 0,
        profile.id,
      ],
    );
  }

  // Cập nhật current_stock trên product (hoặc variant nếu có)
  if (input.variant_id) {
    await query(
      'UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ?',
      [input.qty_good, input.variant_id],
    );
  }
  await query(
    'UPDATE products SET current_stock = current_stock + ? WHERE id = ?',
    [input.qty_good, input.product_id],
  );

  revalidatePath('/warehouse');
  revalidatePath('/products');
  return { ok: true };
}

// ── Lấy danh sách defects ────────────────────────────────────

export async function getDefects(opts?: {
  unresolved_only?: boolean;
  po_id?: string;
}): Promise<DefectWithContext[]> {
  await requireUser();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts?.unresolved_only) {
    conditions.push('d.is_resolved = 0');
  }
  if (opts?.po_id) {
    conditions.push('d.po_id = ?');
    params.push(opts.po_id);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const { rows } = await query<DefectWithContext & { image_urls: string }>(
    `SELECT d.*,
            po.code AS po_code,
            p.name  AS product_name,
            pv.color AS variant_color,
            pv.size  AS variant_size
     FROM defects d
     JOIN purchase_orders po ON d.po_id = po.id
     JOIN products p         ON d.product_id = p.id
     LEFT JOIN product_variants pv ON d.variant_id = pv.id
     ${where}
     ORDER BY d.created_at DESC
     LIMIT 500`,
    params,
  );

  return rows.map((r) => ({
    ...r,
    loss_vnd: Number(r.loss_vnd),
    quantity: Number(r.quantity),
    is_resolved: Boolean(r.is_resolved),
    image_urls: r.image_urls ? JSON.parse(r.image_urls as unknown as string) : null,
  }));
}

// ── Giải quyết defect ────────────────────────────────────────

export async function resolveDefect(
  defectId: string,
  opts: { handling_method: DefectHandlingMethod; handling_notes?: string },
): Promise<ActionResult> {
  const profile = await requireUser();

  await query(
    `UPDATE defects SET
       handling_method = ?,
       handling_notes  = ?,
       is_resolved     = 1,
       resolved_at     = NOW(),
       resolved_by     = ?
     WHERE id = ?`,
    [opts.handling_method, opts.handling_notes || null, profile.id, defectId],
  );

  revalidatePath('/warehouse');
  return { ok: true };
}
