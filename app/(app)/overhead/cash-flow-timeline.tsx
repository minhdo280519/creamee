'use client';

import * as React from 'react';
import { vnd } from '@/lib/utils';
import type { DailyBalance, CashFlowEvent } from '@/lib/cash-forecast';
import { Badge } from '@/components/ui/badge';

interface Props {
  balances: DailyBalance[];
  events: CashFlowEvent[];
}

export function CashFlowTimeline({ balances, events }: Props) {
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);

  const maxAbs = Math.max(...balances.map((b) => Math.abs(b.cumulative)), 1);
  const minCumulative = Math.min(...balances.map((b) => b.cumulative));

  const selectedEvents = selectedDate
    ? events.filter((e) => e.date === selectedDate)
    : [];

  return (
    <div className="space-y-4">
      {/* Cảnh báo số dư âm */}
      {minCumulative < 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          Cảnh báo: Dự báo số dư âm {vnd(minCumulative)} trong 30 ngày tới.
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground text-xs">Tổng dự thu</p>
          <p className="font-bold text-emerald-600">
            {vnd(balances.reduce((s, b) => s + b.inflow, 0))}
          </p>
        </div>
        <div className="rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground text-xs">Tổng dự chi</p>
          <p className="font-bold text-destructive">
            {vnd(balances.reduce((s, b) => s + b.outflow, 0))}
          </p>
        </div>
        <div className="rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground text-xs">Số dư cuối kỳ</p>
          <p className={`font-bold ${(balances[balances.length - 1]?.cumulative ?? 0) >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
            {vnd(balances[balances.length - 1]?.cumulative ?? 0)}
          </p>
        </div>
      </div>

      {/* Timeline bars */}
      <div className="rounded-lg border p-4">
        <p className="text-xs text-muted-foreground mb-3">Nhấn vào ngày để xem chi tiết</p>
        <div className="flex gap-0.5 items-end" style={{ height: 120 }}>
          {balances.map((b) => {
            const isSelected = selectedDate === b.date;
            const heightPct = Math.abs(b.cumulative) / maxAbs;
            const isNegative = b.cumulative < 0;
            const dayLabel = new Date(b.date + 'T00:00:00').getDate();

            return (
              <div
                key={b.date}
                className="flex flex-col items-center cursor-pointer group flex-1"
                onClick={() => setSelectedDate(isSelected ? null : b.date)}
                title={`${b.date}: ${vnd(b.cumulative)}`}
              >
                <div
                  className={`w-full rounded-sm transition-opacity ${
                    isNegative ? 'bg-destructive' : 'bg-emerald-500'
                  } ${isSelected ? 'ring-2 ring-primary ring-offset-1' : 'group-hover:opacity-80'}`}
                  style={{ height: `${Math.max(heightPct * 100, 2)}%` }}
                />
                {(b.inflow > 0 || b.outflow > 0) && (
                  <span className="text-[8px] mt-0.5 text-muted-foreground">{dayLabel}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel for selected date */}
      {selectedDate && selectedEvents.length > 0 && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">
            Chi tiết ngày {new Date(selectedDate + 'T00:00:00').toLocaleDateString('vi-VN')}
          </p>
          <div className="space-y-1">
            {selectedEvents.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={e.type === 'inflow' ? 'success' : 'destructive'}
                    className="text-[10px] px-1.5"
                  >
                    {e.type === 'inflow' ? '↑ Thu' : '↓ Chi'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{e.source}</span>
                </div>
                <span className={`font-medium text-xs ${e.type === 'inflow' ? 'text-emerald-600' : 'text-destructive'}`}>
                  {e.type === 'inflow' ? '+' : '-'}{vnd(e.amount_vnd)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
