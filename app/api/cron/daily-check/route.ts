/**
 * app/api/cron/daily-check/route.ts
 * Cron 8h sáng — kiểm tra đơn quá hạn, chờ duyệt, tồn thấp, shipment trễ.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const report = {
    overdue_ar: 0,
    pending_approvals: 0,
    low_stock: 0,
    delayed_shipments: 0,
  };

  // ── 1. Đơn quá hạn thanh toán (> 30 ngày) ────────────────────────
  const { rows: overdue } = await query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM sales_orders
     WHERE payment_status != 'paid'
       AND status NOT IN ('cancelled','draft')
       AND DATEDIFF(NOW(), order_date) > 30`,
  );
  report.overdue_ar = overdue[0]?.cnt ?? 0;

  // ── 2. Đơn chờ duyệt ─────────────────────────────────────────────
  const { rows: pending } = await query<{ cnt: number }>(
    "SELECT COUNT(*) AS cnt FROM sales_orders WHERE status = 'pending_approval'",
  );
  report.pending_approvals = pending[0]?.cnt ?? 0;

  if (report.pending_approvals > 0) {
    const { rows: approvers } = await query<{ id: string }>(
      "SELECT id FROM profiles WHERE role IN ('owner','manager','accountant_lead') AND is_active = 1",
    );
    for (const a of approvers) {
      await query(
        `INSERT INTO notifications (id, recipient_id, type, title, body, link)
         VALUES (UUID(), ?, 'approval', 'Đơn chờ duyệt', ?, '/sales-orders')`,
        [a.id, `Có ${report.pending_approvals} đơn bán đang chờ duyệt.`],
      );
    }
  }

  // ── 3. Sản phẩm tồn thấp ─────────────────────────────────────────
  const { rows: lowStock } = await query<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM products WHERE current_stock <= reorder_point AND is_active = 1',
  );
  report.low_stock = lowStock[0]?.cnt ?? 0;

  // ── 4. Chặng vận chuyển trễ ──────────────────────────────────────
  const { rows: shipments } = await query<{ id: string; leg: string; dispatched_at: string }>(
    "SELECT id, leg, dispatched_at FROM shipments WHERE dispatched_at IS NOT NULL AND arrived_at IS NULL",
  );

  for (const s of shipments) {
    const days = Math.floor(
      (Date.now() - new Date(s.dispatched_at).getTime()) / 86400000,
    );
    const threshold = s.leg === 'cn_to_vn' ? 14 : 7;
    if (days > threshold) {
      report.delayed_shipments += 1;
      await query(
        "UPDATE shipments SET delay_status = ? WHERE id = ?",
        [`Trễ ${days - threshold} ngày`, s.id],
      );
    }
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), report });
}
