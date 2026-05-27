/**
 * app/api/cron/fx-update/route.ts
 * Cron cập nhật tỷ giá CNY→VND, USD→VND từ open.er-api.com (free).
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

  let cnyToVnd = 0;
  let usdToVnd = 0;

  try {
    const [cnyRes, usdRes] = await Promise.all([
      fetch('https://open.er-api.com/v6/latest/CNY'),
      fetch('https://open.er-api.com/v6/latest/USD'),
    ]);
    const cnyData = (await cnyRes.json()) as { rates?: Record<string, number> };
    const usdData = (await usdRes.json()) as { rates?: Record<string, number> };
    cnyToVnd = cnyData.rates?.VND ?? 0;
    usdToVnd = usdData.rates?.VND ?? 0;
  } catch {
    return NextResponse.json({ error: 'Không lấy được tỷ giá' }, { status: 502 });
  }

  if (cnyToVnd <= 0) {
    return NextResponse.json({ error: 'Tỷ giá không hợp lệ' }, { status: 502 });
  }

  const today = new Date().toISOString().slice(0, 10);

  await query(
    `INSERT INTO fx_rates (id, rate_date, from_currency, to_currency, rate)
     VALUES (UUID(), ?, 'CNY', 'VND', ?), (UUID(), ?, 'USD', 'VND', ?)
     ON DUPLICATE KEY UPDATE rate = VALUES(rate)`,
    [today, cnyToVnd, today, usdToVnd],
  );

  await query(
    `INSERT INTO app_settings (id, \`key\`, value)
     VALUES (UUID(), 'fx_cny_vnd', ?)
     ON DUPLICATE KEY UPDATE value = ?`,
    [Math.round(cnyToVnd), Math.round(cnyToVnd)],
  );

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    rates: { cnyToVnd, usdToVnd },
  });
}
