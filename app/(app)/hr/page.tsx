import { requireAccess } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { HRClient } from './hr-client';
import { getEmployees, getPayrollByMonth } from './actions';

export const metadata = { title: 'Nhân sự & Lương — CREAMEE ERP' };

export default async function HRPage() {
  await requireAccess('/hr');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [employees, payroll] = await Promise.all([
    getEmployees(),
    getPayrollByMonth(year, month),
  ]);

  return (
    <div>
      <PageHeader
        title="Nhân sự & Lương"
        description={`${employees.length} nhân viên • Bảng lương tháng ${month}/${year}`}
      />
      <HRClient year={year} month={month} employees={employees} payroll={payroll} />
    </div>
  );
}
