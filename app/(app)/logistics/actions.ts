'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { generateCode } from '@/lib/db/helpers';
import type { ShipmentLeg, ChargeMode } from '@/lib/landed-cost';
import type { ActionResult } from '@/app/(app)/customers/actions';

// ── Carrier ──────────────────────────────────────────────────────────────────

export async function createCarrier(values: {
  name: string;
  contact?: string;
  rate_cny_per_kg: number;
  min_charge_cny?: number;
}): Promise<ActionResult<{ id: string }>> {
  await requireUser();

  if (!values.name.trim()) {
    return { ok: false, error: 'Vui lòng nhập tên đơn vị vận chuyển' };
  }

  const id = crypto.randomUUID();
  await query(
    `INSERT INTO shipping_carriers
     (id, name, contact, rate_cny_per_kg, min_charge_cny, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, values.name, values.contact || null,
     values.rate_cny_per_kg || 0, values.min_charge_cny || 0],
  );
  await query(
    `INSERT INTO carrier_rate_history (id, carrier_id, rate_cny_per_kg)
     VALUES (UUID(), ?, ?)`,
    [id, values.rate_cny_per_kg || 0],
  );

  revalidatePath('/logistics');
  return { ok: true, data: { id } };
}

export async function updateCarrierRate(id: string, newRate: number): Promise<ActionResult> {
  await requireUser();

  await query(
    'UPDATE shipping_carriers SET rate_cny_per_kg = ? WHERE id = ?',
    [newRate, id],
  );
  await query(
    `INSERT INTO carrier_rate_history (id, carrier_id, rate_cny_per_kg)
     VALUES (UUID(), ?, ?)`,
    [id, newRate],
  );

  revalidatePath('/logistics');
  return { ok: true };
}

// ── Chặng vận chuyển ─────────────────────────────────────────────────────────

export interface LegItemDraft {
  po_id: string;
  po_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  weight_kg: number;
}

export interface CreateLegDraft {
  leg: ShipmentLeg;
  tracking_number?: string;
  so_id?: string;
  so_code?: string;
  carrier_id?: string;
  payer: 'ncc_advance' | 'we_pay_now' | 'we_arrange';
  charge_mode: ChargeMode;
  rate_per_kg_cny: number;
  flat_cost: number;
  currency: string;
  fx_rate: number;
  notes?: string;
  items: LegItemDraft[];
}

/**
 * Tạo một chặng vận chuyển.
 */
export async function createShipmentLeg(
  draft: CreateLegDraft,
): Promise<ActionResult<{ id: string; code: string }>> {
  const profile = await requireUser();

  const isCustomerShip = draft.leg === 'vn_to_customer';
  if (!isCustomerShip && draft.items.length === 0) {
    return { ok: false, error: 'Chặng cần ít nhất 1 dòng hàng' };
  }
  if (isCustomerShip && !draft.so_id) {
    return { ok: false, error: 'Chặng giao khách cần chọn đơn bán hàng' };
  }
  for (const [i, it] of draft.items.entries()) {
    if (!it.po_item_id) return { ok: false, error: `Dòng ${i + 1}: chưa chọn dòng đơn mua` };
    if (it.weight_kg <= 0) return { ok: false, error: `Dòng ${i + 1}: trọng lượng phải > 0` };
  }
  if (draft.charge_mode === 'per_kg' && draft.rate_per_kg_cny <= 0) {
    return { ok: false, error: 'Đơn giá theo kg phải > 0' };
  }
  if (draft.charge_mode === 'flat' && draft.flat_cost <= 0) {
    return { ok: false, error: 'Phí trọn gói phải > 0' };
  }

  const code = await generateCode('SHP');
  const id = crypto.randomUUID();

  const { affectedRows } = await query(
    `INSERT INTO shipments
     (id, code, tracking_number, so_id, so_code, leg, carrier_id, payer, charge_mode,
      rate_per_kg_cny, flat_cost, currency, fx_rate, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, code,
      draft.tracking_number || null,
      draft.so_id || null, draft.so_code || null,
      draft.leg,
      draft.carrier_id || null, draft.payer, draft.charge_mode,
      draft.rate_per_kg_cny || 0, draft.flat_cost || 0,
      draft.currency, draft.fx_rate,
      draft.notes || null, profile.id,
    ],
  );

  if (affectedRows === 0) return { ok: false, error: 'Không tạo được chặng' };

  for (const it of draft.items) {
    await query(
      `INSERT INTO shipment_items
       (id, shipment_id, po_id, po_item_id, product_id, product_name_snapshot,
        quantity, weight_kg)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
      [id, it.po_id, it.po_item_id, it.product_id, it.product_name,
       it.quantity, it.weight_kg],
    );
  }

  revalidatePath('/logistics');
  revalidatePath('/purchase-orders');
  return { ok: true, data: { id, code } };
}

/** Cập nhật mốc thời gian chặng (gửi đi / tới nơi). */
export async function updateShipmentTiming(
  id: string,
  field: 'dispatched_at' | 'arrived_at',
): Promise<ActionResult> {
  await requireUser();
  await query(
    `UPDATE shipments SET ${field} = NOW() WHERE id = ?`,
    [id],
  );
  revalidatePath('/logistics');
  return { ok: true };
}
