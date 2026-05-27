import { query, transaction } from '@/lib/mysql/client';
import type { PoolConnection } from 'mysql2/promise';

// ── Sinh mã tuần tự ──────────────────────────────────────────────────────────

/**
 * Sinh mã theo prefix — atomic, tránh race condition.
 * Yêu cầu bảng `code_sequences` trong MySQL schema.
 */
export async function generateCode(prefix: string): Promise<string> {
  await query(
    `INSERT INTO code_sequences (prefix, last_val)
     VALUES (?, 1)
     ON DUPLICATE KEY UPDATE last_val = last_val + 1`,
    [prefix],
  );
  const { rows } = await query<{ last_val: number }>(
    `SELECT last_val FROM code_sequences WHERE prefix = ?`,
    [prefix],
  );
  const n = rows[0]?.last_val ?? 1;
  return `${prefix}${String(n).padStart(6, '0')}`;
}

// ── FIFO ─────────────────────────────────────────────────────────────────────

export interface AllocLine {
  lot_id: string | null;
  lot_code: string;
  qty: number;
  goods_unit_cost: number;
  ship_unit_cost: number;
  is_negative: boolean;
}

export interface ItemAllocation {
  order_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  lines: AllocLine[];
}

/**
 * Gợi ý phân bổ FIFO — lô cũ nhất bán trước.
 * Nếu thiếu hàng → thêm dòng âm (is_negative = true).
 */
export async function suggestFifoAllocation(
  productId: string,
  quantity: number,
): Promise<AllocLine[]> {
  const { rows: lots } = await query<{
    id: string;
    lot_code: string;
    qty_available: number;
    goods_unit_cost: number;
    ship_unit_cost: number;
  }>(
    `SELECT id, lot_code, qty_available, goods_unit_cost, ship_unit_cost
     FROM inventory_lots
     WHERE product_id = ? AND qty_available > 0 AND is_negative = 0
     ORDER BY created_at ASC`,
    [productId],
  );

  const result: AllocLine[] = [];
  let remaining = quantity;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.qty_available);
    result.push({
      lot_id: lot.id,
      lot_code: lot.lot_code,
      qty: take,
      goods_unit_cost: lot.goods_unit_cost,
      ship_unit_cost: lot.ship_unit_cost,
      is_negative: false,
    });
    remaining -= take;
  }

  if (remaining > 0) {
    result.push({
      lot_id: null,
      lot_code: 'NEG',
      qty: remaining,
      goods_unit_cost: 0,
      ship_unit_cost: 0,
      is_negative: true,
    });
  }

  return result;
}

/**
 * Giao hàng — xuất kho theo phân bổ đã xác nhận, trong 1 transaction.
 */
export async function deliverOrderWithAllocation(
  orderId: string,
  allocation: ItemAllocation[],
): Promise<void> {
  await transaction(async (conn: PoolConnection) => {
    for (const item of allocation) {
      for (const line of item.lines) {
        if (line.lot_id && !line.is_negative) {
          await conn.execute(
            `UPDATE inventory_lots
             SET qty_available = qty_available - ?
             WHERE id = ?`,
            [line.qty, line.lot_id],
          );
          // Ghi nhận log xuất lô.
          await conn.execute(
            `INSERT INTO delivery_lot_lines
             (id, order_id, order_item_id, product_id, lot_id, qty,
              goods_unit_cost, ship_unit_cost)
             VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
            [
              orderId,
              item.order_item_id,
              item.product_id,
              line.lot_id,
              line.qty,
              line.goods_unit_cost,
              line.ship_unit_cost,
            ],
          );
        } else if (line.is_negative) {
          // Tạo lô âm — backfill khi nhập hàng sau.
          const negId = crypto.randomUUID();
          await conn.execute(
            `INSERT INTO inventory_lots
             (id, product_id, lot_code, qty_total, qty_available,
              goods_unit_cost, ship_unit_cost, is_negative)
             VALUES (?, ?, 'NEG', ?, ?, 0, 0, 1)`,
            [negId, item.product_id, -line.qty, -line.qty],
          );
          await conn.execute(
            `INSERT INTO delivery_lot_lines
             (id, order_id, order_item_id, product_id, lot_id, qty,
              goods_unit_cost, ship_unit_cost)
             VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0)`,
            [orderId, item.order_item_id, item.product_id, negId, line.qty],
          );
        }
      }

      await conn.execute(
        `UPDATE sales_order_items
         SET delivered_qty = delivered_qty + ?
         WHERE id = ?`,
        [item.quantity, item.order_item_id],
      );
    }

    // Cập nhật trạng thái đơn bán.
    await conn.execute(
      `UPDATE sales_orders
       SET status = 'delivered', delivered_amount = total
       WHERE id = ?`,
      [orderId],
    );
  });
}

/**
 * Hoàn kho khi huỷ đơn đã giao — đảo ngược xuất kho theo log.
 */
export async function restoreLotsForOrder(orderId: string): Promise<void> {
  const { rows: lines } = await query<{ lot_id: string; qty: number }>(
    `SELECT lot_id, SUM(qty) AS qty
     FROM delivery_lot_lines
     WHERE order_id = ?
     GROUP BY lot_id`,
    [orderId],
  );

  await transaction(async (conn: PoolConnection) => {
    for (const d of lines) {
      await conn.execute(
        `UPDATE inventory_lots
         SET qty_available = qty_available + ?
         WHERE id = ?`,
        [d.qty, d.lot_id],
      );
    }
    await conn.execute(
      `DELETE FROM delivery_lot_lines WHERE order_id = ?`,
      [orderId],
    );
    await conn.execute(
      `UPDATE sales_orders
       SET status = 'approved', delivered_amount = 0
       WHERE id = ?`,
      [orderId],
    );
    // Reset delivered_qty trên các dòng.
    await conn.execute(
      `UPDATE sales_order_items SET delivered_qty = 0
       WHERE order_id = ?`,
      [orderId],
    );
  });
}
