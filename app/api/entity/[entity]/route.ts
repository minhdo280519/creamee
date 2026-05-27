/**
 * app/api/entity/[entity]/route.ts
 * Endpoint generic cho EntityCombobox auto-add.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { genCustomerCode } from '@/lib/business-logic';

interface EntityConfig {
  table: string;
  build: (name: string, count: number) => Record<string, unknown>;
}

const ENTITY_CONFIG: Record<string, EntityConfig> = {
  customers: {
    table: 'customers',
    build: (name, count) => ({
      code: genCustomerCode(name, count),
      name,
      tier: 'standard',
      is_active: 1,
    }),
  },
  suppliers: {
    table: 'suppliers',
    build: (name, count) => ({
      code: 'NCC' + String(count + 1).padStart(3, '0'),
      name,
      country: 'CN',
      currency: 'CNY',
      is_active: 1,
    }),
  },
  product_colors: {
    table: 'product_colors',
    build: (name, count) => ({
      code: 'C' + String(count + 1).padStart(3, '0'),
      name_vi: name,
      is_active: 1,
    }),
  },
  shipping_carriers: {
    table: 'shipping_carriers',
    build: (name) => ({
      name,
      rate_cny_per_kg: 0,
      is_active: 1,
    }),
  },
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ entity: string }> },
) {
  const { entity } = await context.params;
  const config = ENTITY_CONFIG[entity];

  if (!config) {
    return NextResponse.json(
      { error: `Entity "${entity}" không được hỗ trợ` },
      { status: 400 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Thiếu tên' }, { status: 400 });
  }

  const { rows: cnt } = await query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM \`${config.table}\``,
  );
  const count = cnt[0]?.cnt ?? 0;
  const record = config.build(name, count);

  const id = crypto.randomUUID();
  const fields = Object.keys(record);
  const placeholders = fields.map(() => '?').join(', ');
  const values = fields.map((f) => record[f]);

  const { affectedRows } = await query(
    `INSERT INTO \`${config.table}\` (id, ${fields.map((f) => `\`${f}\``).join(', ')})
     VALUES (?, ${placeholders})`,
    [id, ...values],
  );

  if (affectedRows === 0) {
    return NextResponse.json({ error: 'Không tạo được bản ghi' }, { status: 400 });
  }

  return NextResponse.json({ id, label: name });
}
