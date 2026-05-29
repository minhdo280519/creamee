'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { vnd } from '@/lib/utils';
import type { Employee, PayrollEntryWithEmployee, PayrollStatus } from '@/lib/types';
import { createEmployee, updatePayrollEntry, generatePayroll } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const STATUS_LABELS: Record<PayrollStatus, string> = {
  draft:    'Nháp',
  approved: 'Đã duyệt',
  paid:     'Đã trả',
};

const STATUS_VARIANTS: Record<PayrollStatus, 'secondary' | 'warning' | 'success'> = {
  draft:    'secondary',
  approved: 'warning',
  paid:     'success',
};

interface Props {
  year: number;
  month: number;
  employees: Employee[];
  payroll: PayrollEntryWithEmployee[];
}

type ActiveTab = 'employees' | 'payroll';

export function HRClient({ year, month, employees, payroll }: Props) {
  const router = useRouter();
  const [tab, setTab] = React.useState<ActiveTab>('payroll');
  const [empDialogOpen, setEmpDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Employee form state
  const [empName, setEmpName] = React.useState('');
  const [empPhone, setEmpPhone] = React.useState('');
  const [empPosition, setEmpPosition] = React.useState('');
  const [empDept, setEmpDept] = React.useState('');
  const [empSalary, setEmpSalary] = React.useState(0);

  const totalPayroll = payroll.reduce((s, p) => s + p.net_salary_vnd, 0);
  const paidCount = payroll.filter((p) => p.status === 'paid').length;

  async function handleCreateEmployee() {
    if (!empName.trim()) { toast.error('Tên bắt buộc'); return; }
    setSaving(true);
    try {
      const r = await createEmployee({
        full_name: empName.trim(),
        phone: empPhone,
        position: empPosition,
        department: empDept,
        base_salary_vnd: empSalary,
      });
      if (!r.ok) { toast.error(r.error ?? 'Tạo thất bại'); return; }
      toast.success('Đã thêm nhân viên');
      setEmpDialogOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleGeneratePayroll() {
    setSaving(true);
    try {
      const r = await generatePayroll(year, month);
      if (!r.ok) { toast.error(r.error ?? 'Thất bại'); return; }
      toast.success('Đã tạo bảng lương');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handlePayrollStatus(id: string, status: PayrollStatus) {
    const r = await updatePayrollEntry(id, { status });
    if (!r.ok) { toast.error(r.error ?? 'Thất bại'); return; }
    toast.success(`Đã cập nhật: ${STATUS_LABELS[status]}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tổng nhân viên</p>
            <p className="text-2xl font-bold">{employees.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tổng lương tháng {month}/{year}</p>
            <p className="text-2xl font-bold">{vnd(totalPayroll)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Đã trả lương</p>
            <p className="text-2xl font-bold">{paidCount}/{payroll.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['payroll', 'employees'] as ActiveTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-sm transition-colors ${
              tab === t ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t === 'payroll' ? `Bảng lương tháng ${month}/${year}` : 'Danh sách nhân viên'}
          </button>
        ))}
      </div>

      {/* Tab: Payroll */}
      {tab === 'payroll' && (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={saving} onClick={handleGeneratePayroll}>
              Tạo bảng lương
            </Button>
          </div>
          {payroll.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Chưa có bảng lương. Nhấn "Tạo bảng lương" để generate từ danh sách nhân viên.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">Nhân viên</th>
                    <th className="px-3 py-2 text-left">Vị trí</th>
                    <th className="px-3 py-2 text-right">Lương cơ bản</th>
                    <th className="px-3 py-2 text-right">Phụ cấp</th>
                    <th className="px-3 py-2 text-right">Thưởng</th>
                    <th className="px-3 py-2 text-right">Khấu trừ</th>
                    <th className="px-3 py-2 text-right font-semibold">Thực lãnh</th>
                    <th className="px-3 py-2 text-center">Trạng thái</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {payroll.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <p className="font-medium text-sm">{p.employee_name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.employee_code}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{p.position ?? '—'}</td>
                      <td className="px-3 py-2 text-right">{vnd(p.base_salary_vnd)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{vnd(p.allowance_vnd)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{vnd(p.bonus_vnd)}</td>
                      <td className="px-3 py-2 text-right text-destructive">{vnd(p.deduction_vnd)}</td>
                      <td className="px-3 py-2 text-right font-bold">{vnd(p.net_salary_vnd)}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={STATUS_VARIANTS[p.status]} className="text-xs">
                          {STATUS_LABELS[p.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {p.status === 'draft' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => handlePayrollStatus(p.id, 'approved')}>
                            Duyệt
                          </Button>
                        )}
                        {p.status === 'approved' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => handlePayrollStatus(p.id, 'paid')}>
                            Trả lương
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td colSpan={6} className="px-3 py-2 text-sm font-medium text-right">Tổng cộng</td>
                    <td className="px-3 py-2 text-right font-bold">{vnd(totalPayroll)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Employees */}
      {tab === 'employees' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEmpDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Thêm nhân viên
            </Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left">Mã NV</th>
                  <th className="px-3 py-2 text-left">Họ tên</th>
                  <th className="px-3 py-2 text-left">Vị trí</th>
                  <th className="px-3 py-2 text-left">Phòng ban</th>
                  <th className="px-3 py-2 text-left">SĐT</th>
                  <th className="px-3 py-2 text-right">Lương cơ bản</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Chưa có nhân viên nào.
                  </td></tr>
                )}
                {employees.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs">{e.code}</td>
                    <td className="px-3 py-2 font-medium">{e.full_name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{e.position ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{e.department ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{e.phone ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">{vnd(e.base_salary_vnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employee create dialog */}
      <Dialog open={empDialogOpen} onOpenChange={setEmpDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Thêm nhân viên mới</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Họ tên *</Label>
              <Input value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="Nguyễn Văn A" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vị trí</Label>
                <Input value={empPosition} onChange={(e) => setEmpPosition(e.target.value)} placeholder="VD: Kho, Sales..." />
              </div>
              <div className="space-y-1.5">
                <Label>Phòng ban</Label>
                <Input value={empDept} onChange={(e) => setEmpDept(e.target.value)} placeholder="VD: Kho, Kinh doanh..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>SĐT</Label>
                <Input value={empPhone} onChange={(e) => setEmpPhone(e.target.value)} placeholder="0909..." />
              </div>
              <div className="space-y-1.5">
                <Label>Lương cơ bản (VND)</Label>
                <Input type="number" step={500000} value={empSalary}
                  onChange={(e) => setEmpSalary(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEmpDialogOpen(false)}>Huỷ</Button>
              <Button onClick={handleCreateEmployee} disabled={saving}>
                {saving ? '...' : 'Tạo nhân viên'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
