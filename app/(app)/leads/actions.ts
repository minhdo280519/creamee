'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { generateCode } from '@/lib/db/helpers';
import type { ActionResult } from '@/app/(app)/customers/actions';

export type LeadStatus = 'new' | 'consulting' | 'quoted' | 'won' | 'lost';

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new:        'Mới tiếp nhận',
  consulting: 'Đang tư vấn',
  quoted:     'Đã báo giá',
  won:        'Đã chốt',
  lost:       'Đã mất',
};

export const LEAD_STATUS_VARIANT: Record<LeadStatus, 'default' | 'secondary' | 'warning' | 'success' | 'destructive'> = {
  new:        'secondary',
  consulting: 'warning',
  quoted:     'default',
  won:        'success',
  lost:       'destructive',
};

export const LEAD_SOURCES = [
  'Facebook Ads',
  'Zalo',
  'Giới thiệu',
  'Website',
  'Khác',
] as const;

export interface Lead {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  source: string | null;
  need: string | null;
  status: LeadStatus;
  assigned_to_email: string | null;
  customer_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function createLead(values: {
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  source?: string;
  need?: string;
  status?: LeadStatus;
  assigned_to_email?: string;
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  await requireUser();

  const name = values.name?.trim();
  if (!name) return { ok: false, error: 'Tên khách hàng tiềm năng bắt buộc' };

  const id = crypto.randomUUID();
  const code = await generateCode('LEAD');

  await query(
    `INSERT INTO leads
     (id, code, name, phone, email, city, source, need, status, assigned_to_email, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, code, name,
      values.phone || null,
      values.email || null,
      values.city || null,
      values.source || 'Facebook Ads',
      values.need || null,
      values.status || 'new',
      values.assigned_to_email || null,
      values.notes || null,
    ],
  );

  revalidatePath('/leads');
  return { ok: true, data: { id } };
}

export async function updateLead(
  id: string,
  values: {
    name?: string;
    phone?: string;
    email?: string;
    city?: string;
    source?: string;
    need?: string;
    status?: LeadStatus;
    assigned_to_email?: string;
    notes?: string;
  },
): Promise<ActionResult> {
  await requireUser();

  await query(
    `UPDATE leads SET
       name = ?, phone = ?, email = ?, city = ?, source = ?,
       need = ?, status = ?, assigned_to_email = ?, notes = ?
     WHERE id = ?`,
    [
      values.name,
      values.phone || null,
      values.email || null,
      values.city || null,
      values.source || null,
      values.need || null,
      values.status || 'new',
      values.assigned_to_email || null,
      values.notes || null,
      id,
    ],
  );

  revalidatePath('/leads');
  return { ok: true };
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<ActionResult> {
  await requireUser();

  await query('UPDATE leads SET status = ? WHERE id = ?', [status, id]);

  revalidatePath('/leads');
  return { ok: true };
}

/** Chuyển lead đã chốt thành khách hàng — tạo mới KH và gắn customer_id vào lead. */
export async function convertLeadToCustomer(
  id: string,
): Promise<ActionResult<{ customerId: string }>> {
  await requireUser();

  const { rows } = await query<Lead>(
    'SELECT * FROM leads WHERE id = ? LIMIT 1',
    [id],
  );
  const lead = rows[0];
  if (!lead) return { ok: false, error: 'Không tìm thấy lead' };
  if (lead.customer_id) return { ok: false, error: 'Lead này đã được chuyển thành khách hàng' };

  // Kiểm tra KH cùng tên/SĐT chưa tồn tại
  if (lead.phone) {
    const { rows: exist } = await query<{ id: string }>(
      'SELECT id FROM customers WHERE phone = ? LIMIT 1',
      [lead.phone],
    );
    if (exist[0]) {
      // Gắn luôn, không tạo mới
      await query('UPDATE leads SET status = \'won\', customer_id = ? WHERE id = ?', [exist[0].id, id]);
      revalidatePath('/leads');
      revalidatePath('/customers');
      return { ok: true, data: { customerId: exist[0].id } };
    }
  }

  const customerId = crypto.randomUUID();

  // Đếm số KH để sinh mã
  const { rows: cnt } = await query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM customers');
  const customerCode = 'KH' + String((cnt[0]?.cnt ?? 0) + 1).padStart(3, '0');

  await query(
    `INSERT INTO customers (id, code, name, phone, email, city, source, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      customerId, customerCode, lead.name,
      lead.phone || null,
      lead.email || null,
      lead.city || null,
      lead.source || null,
    ],
  );

  await query(
    'UPDATE leads SET status = \'won\', customer_id = ? WHERE id = ?',
    [customerId, id],
  );

  revalidatePath('/leads');
  revalidatePath('/customers');
  return { ok: true, data: { customerId } };
}

export async function deleteLead(id: string): Promise<ActionResult> {
  await requireUser();
  await query('DELETE FROM leads WHERE id = ?', [id]);
  revalidatePath('/leads');
  return { ok: true };
}
