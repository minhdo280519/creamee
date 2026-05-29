'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { vnd } from '@/lib/utils';
import type { OrderCostAllocation, Fund, FundTransaction, FundType } from '@/lib/types';
import type { DailyBalance, CashFlowEvent } from '@/lib/cash-forecast';
import { CashFlowTimeline } from './cash-flow-timeline';
import {
  upsertOverheadCost, OVERHEAD_CATEGORIES,
  fundDeposit, fundWithdrawal, allocateOverheadToOrder,
} from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const FUND_LABELS: Record<FundType, string> = {
  reserve:           'Quỹ Dự Phòng',
  profit_withdrawal: 'Quỹ Lợi Nhuận Rút',
  operating:         'Quỹ Vận Hành',
};

interface Props {
  year: number;
  month: number;
  overheadByCategory: { category: string; amount_vnd: number }[];
  allocations: (OrderCostAllocation & { so_code: string; customer_name: string })[];
  funds: Fund[];
  fundTransactions: FundTransaction[];
  forecastBalances: DailyBalance[];
  forecastEvents: CashFlowEvent[];
}

type ActiveTab = 'overhead' | 'allocations' | 'funds' | 'fund_history' | 'forecast';

export function OverheadClient({
  year, month, overheadByCategory, allocations, funds, fundTransactions,
  forecastBalances, forecastEvents,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = React.useState<ActiveTab>('overhead');
  const [saving, setSaving] = React.useState(false);
  const [fundDialogType, setFundDialogType] = React.useState<'deposit' | 'withdrawal' | null>(null);
  const [selectedFund, setSelectedFund] = React.useState<FundType>('operating');
  const [fundAmount, setFundAmount] = React.useState(0);
  const [fundReason, setFundReason] = React.useState('');

  // Overhead entry state
  const [ohEditing, setOhEditing] = React.useState<Record<string, number>>(
    Object.fromEntries(overheadByCategory.map((r) => [r.category, r.amount_vnd])),
  );

  const totalOverhead = Object.values(ohEditing).reduce((s, v) => s + (v || 0), 0);
  const totalRevenue = allocations.reduce((s, a) => s + a.revenue_vnd, 0);
  const totalNetProfit = allocations.reduce((s, a) => s + a.net_profit_vnd, 0);
  const totalFundBalance = funds.reduce((s, f) => s + f.balance_vnd, 0);

  async function saveOverhead(category: string) {
    const amount = ohEditing[category] ?? 0;
    setSaving(true);
    try {
      const r = await upsertOverheadCost({ year, month, category, amount_vnd: amount });
      if (!r.ok) { toast.error(r.error ?? 'Lỗi lưu overhead'); return; }
      toast.success(`Đã lưu: ${category}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleFundAction() {
    if (fundAmount <= 0) { toast.error('Số tiền phải > 0'); return; }
    setSaving(true);
    try {
      const fn = fundDialogType === 'deposit' ? fundDeposit : fundWithdrawal;
      const r = await fn({ fund_type: selectedFund, amount_vnd: fundAmount, reason: fundReason });
      if (!r.ok) { toast.error(r.error ?? 'Thất bại'); return; }
      toast.success(fundDialogType === 'deposit' ? 'Đã nạp quỹ' : 'Đã rút quỹ');
      setFundDialogType(null);
      setFundAmount(0);
      setFundReason('');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'overhead',    label: 'Chi phí cố định' },
    { key: 'allocations', label: 'Phân bổ theo đơn' },
    { key: 'funds',       label: 'Quỹ tiền' },
    { key: 'fund_history', label: 'Lịch sử quỹ' },
    { key: 'forecast',    label: 'Dự báo dòng tiền 30 ngày' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Overhead tháng {month}/{year}</p>
            <p className="text-lg font-bold text-amber-600">{vnd(totalOverhead)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Doanh thu (đã alloc)</p>
            <p className="text-lg font-bold">{vnd(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Lãi ròng (đã alloc)</p>
            <p className={`text-lg font-bold ${totalNetProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
              {vnd(totalNetProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tổng quỹ</p>
            <p className="text-lg font-bold text-blue-600">{vnd(totalFundBalance)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm transition-colors ${
              tab === t.key
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Chi phí cố định */}
      {tab === 'overhead' && (
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="text-sm font-medium">Chi phí cố định tháng {month}/{year}</p>
            <p className="text-xs text-muted-foreground">Nhập số tiền và nhấn Enter để lưu</p>
          </div>
          <div className="p-4 space-y-2">
            {OVERHEAD_CATEGORIES.map((cat) => (
              <div key={cat} className="flex items-center gap-3">
                <Label className="w-48 text-sm flex-shrink-0">{cat}</Label>
                <Input
                  type="number"
                  step={100000}
                  className="w-48"
                  value={ohEditing[cat] ?? 0}
                  onChange={(e) => setOhEditing((prev) => ({ ...prev, [cat]: Number(e.target.value) }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveOverhead(cat); }}
                />
                <Button size="sm" variant="outline" disabled={saving}
                  onClick={() => saveOverhead(cat)}>
                  Lưu
                </Button>
              </div>
            ))}
            <div className="border-t pt-2 flex items-center gap-3">
              <span className="w-48 text-sm font-semibold">Tổng cộng</span>
              <span className="w-48 text-right font-bold text-amber-600">{vnd(totalOverhead)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Phân bổ theo đơn */}
      {tab === 'allocations' && (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left">Đơn SO</th>
                <th className="px-3 py-2 text-left">Khách hàng</th>
                <th className="px-3 py-2 text-right">Doanh thu</th>
                <th className="px-3 py-2 text-right">COGS</th>
                <th className="px-3 py-2 text-right">Ship</th>
                <th className="px-3 py-2 text-right">Overhead</th>
                <th className="px-3 py-2 text-right">Lãi gộp</th>
                <th className="px-3 py-2 text-right">Lãi ròng</th>
              </tr>
            </thead>
            <tbody>
              {allocations.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground text-sm">
                  Chưa có phân bổ nào. Dùng nút "Phân bổ overhead" trên trang Analytics.
                </td></tr>
              )}
              {allocations.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs">{a.so_code}</td>
                  <td className="px-3 py-2 text-xs">{a.customer_name}</td>
                  <td className="px-3 py-2 text-right">{vnd(a.revenue_vnd)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{vnd(a.direct_cogs_vnd)}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{vnd(a.ship_cost_vnd)}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{vnd(a.overhead_allocated_vnd)}</td>
                  <td className="px-3 py-2 text-right font-medium">{vnd(a.gross_profit_vnd)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${a.net_profit_vnd >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {vnd(a.net_profit_vnd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Quỹ tiền */}
      {tab === 'funds' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {funds.map((f) => (
              <Card key={f.fund_type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{FUND_LABELS[f.fund_type]}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-2xl font-bold">{vnd(f.balance_vnd)}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1"
                      onClick={() => { setSelectedFund(f.fund_type); setFundDialogType('deposit'); }}>
                      Nạp
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1"
                      onClick={() => { setSelectedFund(f.fund_type); setFundDialogType('withdrawal'); }}>
                      Rút
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Lịch sử quỹ */}
      {tab === 'fund_history' && (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left">Quỹ</th>
                <th className="px-3 py-2 text-left">Loại</th>
                <th className="px-3 py-2 text-right">Số tiền</th>
                <th className="px-3 py-2 text-left">Lý do</th>
                <th className="px-3 py-2 text-left">Ngày</th>
              </tr>
            </thead>
            <tbody>
              {fundTransactions.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Chưa có giao dịch nào.</td></tr>
              )}
              {fundTransactions.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs">{FUND_LABELS[t.fund_type]}</td>
                  <td className="px-3 py-2">
                    <Badge variant={t.transaction_type === 'deposit' ? 'success' : 'destructive'} className="text-xs">
                      {t.transaction_type === 'deposit' ? 'Nạp' : 'Rút'}
                    </Badge>
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${
                    t.transaction_type === 'deposit' ? 'text-emerald-600' : 'text-destructive'
                  }`}>
                    {t.transaction_type === 'deposit' ? '+' : '-'}{vnd(t.amount_vnd)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{t.reason ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Dự báo dòng tiền */}
      {tab === 'forecast' && (
        <CashFlowTimeline balances={forecastBalances} events={forecastEvents} />
      )}

      {/* Fund deposit/withdrawal dialog */}
      <Dialog open={!!fundDialogType} onOpenChange={(o) => { if (!o) setFundDialogType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {fundDialogType === 'deposit' ? 'Nạp vào' : 'Rút từ'} {FUND_LABELS[selectedFund]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Quỹ</Label>
              <Select value={selectedFund} onValueChange={(v) => setSelectedFund(v as FundType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FUND_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Số tiền (VND)</Label>
              <Input type="number" step={100000} value={fundAmount}
                onChange={(e) => setFundAmount(Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="space-y-1.5">
              <Label>Lý do</Label>
              <Input value={fundReason} onChange={(e) => setFundReason(e.target.value)}
                placeholder="Ghi chú lý do..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFundDialogType(null)}>Huỷ</Button>
              <Button onClick={handleFundAction} disabled={saving}>
                {saving ? '...' : fundDialogType === 'deposit' ? 'Nạp quỹ' : 'Rút quỹ'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
