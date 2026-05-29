'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { generateCode } from '@/lib/db/helpers';
import type { ActionResult } from '@/app/(app)/customers/actions';
import type { Employee, PayrollEntry, PayrollEntryWithEmployee, PayrollStatus } from '@/lib/types';

// ── Employee CRUD ────────────────────────────────────────────

export async function getEmployees(): Promise<Employee[]> {
  await requireUser();
  const { rows } = await query<Employee>(
    'SELECT * FROM employees WHERE is_active = 1 ORDER BY full_name',
  );
  return rows.map((r) => ({ ...r, base_salary_vnd: Number(r.base_salary_vnd), is_active: Boolean(r.is_active) }));
}

export async function createEmployee(data: {
  full_name: string;
  phone?: string;
  email?: string;
  position?: string;
  department?: string;
  base_salary_vnd: number;
  bank_name?: string;
  bank_account?: string;
  hire_date?: string;
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const code = await generateCode('EMP');
  const id = crypto.randomUUID();

  await query(
    `INSERT INTO employees
     (id, code, full_name, phone, email, position, department,
      base_salary_vnd, bank_name, bank_account, hire_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, code, data.full_name,
     data.phone || null, data.email || null,
     data.position || null, data.department || null,
     data.base_salary_vnd,
     data.bank_name || null, data.bank_account || null,
     data.hire_date || null, data.notes || null],
  );
  revalidatePath('/hr');
  return { ok: true, data: { id } };
}

export async function updateEmployee(id: string, data: Partial<{
  full_name: string; phone: string; email: string;
  position: string; department: string; base_salary_vnd: number;
  bank_name: string; bank_account: string; hire_date: string;
  terminate_date: string; notes: string; is_active: boolean;
}>): Promise<ActionResult> {
  await requireUser();
  await query(
    `UPDATE employees SET
       full_name = COALESCE(?, full_name),
       phone = ?, email = ?, position = ?, department = ?,
       base_salary_vnd = COALESCE(?, base_salary_vnd),
       bank_name = ?, bank_account = ?,
       hire_date = COALESCE(?, hire_date),
       terminate_date = ?,
       notes = ?,
       is_active = COALESCE(?, is_active)
     WHERE id = ?`,
    [
      data.full_name || null,
      data.phone ?? null, data.email ?? null,
      data.position ?? null, data.department ?? null,
      data.base_salary_vnd != null ? data.base_salary_vnd : null,
      data.bank_name ?? null, data.bank_account ?? null,
      data.hire_date || null,
      data.terminate_date ?? null,
      data.notes ?? null,
      data.is_active != null ? (data.is_active ? 1 : 0) : null,
      id,
    ],
  );
  revalidatePath('/hr');
  return { ok: true };
}

// ── Payroll ──────────────────────────────────────────────────

export async function getPayrollByMonth(year: number, month: number): Promise<PayrollEntryWithEmployee[]> {
  await requireUser();
  const { rows } = await query<PayrollEntryWithEmployee & Record<string, unknown>>(
    `SELECT pe.*, e.full_name AS employee_name, e.code AS employee_code, e.position
     FROM payroll_entries pe
     JOIN employees e ON pe.employee_id = e.id
     WHERE pe.year = ? AND pe.month = ?
     ORDER BY e.full_name`,
    [year, month],
  );
  return rows.map((r) => ({
    ...r,
    base_salary_vnd: Number(r.base_salary_vnd),
    allowance_vnd: Number(r.allowance_vnd),
    bonus_vnd: Number(r.bonus_vnd),
    deduction_vnd: Number(r.deduction_vnd),
    net_salary_vnd: Number(r.net_salary_vnd),
  })) as PayrollEntryWithEmployee[];
}

export async function generatePayroll(year: number, month: number): Promise<ActionResult> {
  const profile = await requireUser();
  const employees = await getEmployees();

  for (const emp of employees) {
    await query(
      `INSERT INTO payroll_entries
       (id, employee_id, year, month, base_salary_vnd, allowance_vnd, bonus_vnd,
        deduction_vnd, created_by)
       VALUES (UUID(), ?, ?, ?, ?, 0, 0, 0, ?)
       ON DUPLICATE KEY UPDATE base_salary_vnd = VALUES(base_salary_vnd)`,
      [emp.id, year, month, emp.base_salary_vnd, profile.id],
    );
  }
  revalidatePath('/hr');
  return { ok: true };
}

export async function updatePayrollEntry(
  id: string,
  data: { allowance_vnd?: number; bonus_vnd?: number; deduction_vnd?: number; kpi_notes?: string; status?: PayrollStatus },
): Promise<ActionResult> {
  const profile = await requireUser();
  await query(
    `UPDATE payroll_entries SET
       allowance_vnd = COALESCE(?, allowance_vnd),
       bonus_vnd     = COALESCE(?, bonus_vnd),
       deduction_vnd = COALESCE(?, deduction_vnd),
       kpi_notes     = COALESCE(?, kpi_notes),
       status        = COALESCE(?, status),
       paid_at       = CASE WHEN ? = 'paid' THEN NOW() ELSE paid_at END,
       approved_by   = CASE WHEN ? IN ('approved','paid') THEN ? ELSE approved_by END
     WHERE id = ?`,
    [
      data.allowance_vnd ?? null,
      data.bonus_vnd ?? null,
      data.deduction_vnd ?? null,
      data.kpi_notes ?? null,
      data.status ?? null,
      data.status, data.status, profile.id,
      id,
    ],
  );
  revalidatePath('/hr');
  return { ok: true };
}
