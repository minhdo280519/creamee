'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Check, X, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { vnd, formatDate } from '@/lib/utils';
import type { CashTransaction } from '@/lib/types';
import {
  createCashTransaction, approveCashTransaction, rejectCashTransaction,
} from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const INCOME_CATEGORIES = [
  { value: 'sales_payment', label: 'Thu tiền bán hàng' },
  { value: 'customer_deposit', label: 'Khách đặt cọc' },
  { value: 'other_income', label: 'Thu khác' },
];
const EXPENSE_CATEGORIES = [
  { value: 'po_payment', label: 'Trả tiền hàng NCC' },
  { value: 'shipping', label: 'Chi phí vận chuyển' },
  { value: 'salary', label: 'Lương nhân viên' },
  { value: 'rent', label: 'Thuê mặt bằng' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other_expense', label: 'Chi khác' },
];
const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};
const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
};

interface SORef { id: string; code: string; customer_name: string }
interface PORef { id: string; code: string; supplier_name: string }

interface Props {
  transactions: CashTransaction[];
  canApprove: boolean;
  salesOrders: SORef[];
  purchaseOrders: PORef[];
}

export function CashClient({ transactions, canApprove, salesOrders, purchaseOrders }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Form.
  const [type, setType] = React.useState<'income' | 'expense'>('income');
  const [amount, setAmount] = React.useState(0);
  const [category, setCategory] = React.useState('');
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = React.useState('');
  const [method, setMethod] = React.useState('cash');
  const [refCode, setRefCode] = React.useState('');
  const [refType, setRefType] = React.useState('');

  // Tổng thu/chi đã duyệt.
  const summary = React.useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.status !== 'approved') continue;
      if (t.transaction_type === 'income') income += t.amount_vnd;
      else expense += t.amount_vnd;
    }
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (t) =>
        t.code.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q),
    );
  }, [transactions, query]);

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  async function handleSave() {
    if (amount <= 0) {
      toast.error('Số tiền phải lớn hơn 0');
      return;
    }
    if (!category) {
      toast.error('Vui lòng chọn hạng mục');
      return;
    }
    setSaving(true);
    try {
      const r = await createCashTransaction({
        transaction_type: type,
        amount_vnd: amount,
        category,
        transaction_date: date,
        description,
        payment_method: method,
        reference_type: refType || undefined,
        reference_code: refCode || undefined,
      });
      if (!r.ok) {
        toast.error(r.error ?? 'Tạo thất bại');
        return;
      }
      toast.success('Đã ghi nhận giao dịch');
      setDialogOpen(false);
      setAmount(0);
      setCategory('');
      setDescription('');
      setRefCode('');
      setRefType('');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(id: string) {
    const r = await approveCashTransaction(id);
    if (!r.ok) {
      toast.error(r.error ?? 'Duyệt thất bại');
      return;
    }
    toast.success('Đã duyệt giao dịch');
    router.refresh();
  }

  async function handleReject(id: string) {
    const reason = window.prompt('Lý do từ chối:');
    if (reason == null) return;
    const r = await rejectCashTransaction(id, reason);
    if (!r.ok) {
      toast.error(r.error ?? 'Từ chối thất bại');
      return;
    }
    toast.success('Đã từ chối giao dịch');
    router.refresh();
  }

  return (
    <div>
      {/* Tổng quan */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-100 p-2">
              <TrendingUp className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tổng thu</p>
              <p className="text-lg font-semibold text-emerald-700">
                {vnd(summary.income)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-red-100 p-2">
              <TrendingDown className="h-5 w-5 text-red-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tổng chi</p>
              <p className="text-lg font-semibold text-red-700">
                {vnd(summary.expense)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Số dư</p>
              <p
                className={`text-lg font-semibold ${
                  summary.balance >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {vnd(summary.balance)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã, mô tả..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Ghi giao dịch
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Ngày</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Mô tả</TableHead>
              <TableHead className="text-right">Số tiền</TableHead>
              <TableHead>Trạng thái</TableHead>
              {canApprove && <TableHead className="text-right">Duyệt</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.code}</TableCell>
                <TableCell>{formatDate(t.transaction_date)}</TableCell>
                <TableCell>
                  <Badge
                    variant={t.transaction_type === 'income' ? 'success' : 'destructive'}
                  >
                    {t.transaction_type === 'income' ? 'Thu' : 'Chi'}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {t.description ?? '—'}
                </TableCell>
                <TableCell
                  className={`text-right font-medium ${
                    t.transaction_type === 'income'
                      ? 'text-emerald-700'
                      : 'text-red-700'
                  }`}
                >
                  {t.transaction_type === 'income' ? '+' : '−'} {vnd(t.amount_vnd)}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[t.status] ?? 'secondary'}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </Badge>
                </TableCell>
                {canApprove && (
                  <TableCell className="text-right">
                    {t.status === 'pending' && (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleApprove(t.id)}
                        >
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleReject(t.id)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ghi nhận giao dịch tiền</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Loại giao dịch</Label>
                <Select
                  value={type}
                  onValueChange={(v) => {
                    setType(v as 'income' | 'expense');
                    setCategory('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Thu tiền</SelectItem>
                    <SelectItem value="expense">Chi tiền</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Ngày</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Hạng mục</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn hạng mục" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Số tiền (VND)</Label>
                <Input
                  id="amount"
                  type="number"
                  step={1000}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hình thức</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Tiền mặt</SelectItem>
                    <SelectItem value="bank">Chuyển khoản</SelectItem>
                    <SelectItem value="ewallet">Ví điện tử</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Gắn đơn hàng */}
            {(category === 'sales_payment' || category === 'customer_deposit') && (
              <div className="space-y-1.5">
                <Label>Gắn với đơn bán hàng (SO)</Label>
                <Select
                  value={refCode}
                  onValueChange={(v) => { setRefCode(v); setRefType(v ? 'sales_order' : ''); }}
                >
                  <SelectTrigger><SelectValue placeholder="Chọn SO (tuỳ chọn)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Không gắn —</SelectItem>
                    {salesOrders.map((s) => (
                      <SelectItem key={s.id} value={s.code}>
                        {s.code} · {s.customer_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {category === 'po_payment' && (
              <div className="space-y-1.5">
                <Label>Gắn với đơn nhập hàng (PO)</Label>
                <Select
                  value={refCode}
                  onValueChange={(v) => { setRefCode(v); setRefType(v ? 'purchase_order' : ''); }}
                >
                  <SelectTrigger><SelectValue placeholder="Chọn PO (tuỳ chọn)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Không gắn —</SelectItem>
                    {purchaseOrders.map((p) => (
                      <SelectItem key={p.id} value={p.code}>
                        {p.code} · {p.supplier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Huỷ
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                Ghi nhận
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
