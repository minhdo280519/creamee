/**
 * Cash flow forecasting engine
 * Tính dòng tiền vào (AR) và ra (AP) trong 30 ngày tới
 */

export interface CashFlowEvent {
  date: string;        // YYYY-MM-DD
  type: 'inflow' | 'outflow';
  amount_vnd: number;
  source: string;      // VD: "SO-2026001 — Khách A"
  ref_type: 'SO' | 'PO' | 'overhead' | 'other';
  ref_id: string;
}

export interface DailyBalance {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
}

export function buildDailyBalances(
  events: CashFlowEvent[],
  startingBalance: number,
  days = 30,
): DailyBalance[] {
  const today = new Date();
  const result: DailyBalance[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    const dayEvents = events.filter((e) => e.date === dateStr);
    const inflow = dayEvents.filter((e) => e.type === 'inflow').reduce((s, e) => s + e.amount_vnd, 0);
    const outflow = dayEvents.filter((e) => e.type === 'outflow').reduce((s, e) => s + e.amount_vnd, 0);
    const net = inflow - outflow;

    const prev = result.length > 0 ? result[result.length - 1] : null;
    const cumulative = (prev != null ? prev.cumulative : startingBalance) + net;

    result.push({ date: dateStr, inflow, outflow, net, cumulative });
  }

  return result;
}
