import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { query } from '@/lib/db';
import { vnd, formatDate } from '@/lib/utils';
import {
  ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT,
  PAYMENT_STATUS_LABEL, PAYMENT_STATUS_VARIANT,
} from '@/lib/order-status';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { OrderStatus, PaymentStatus } from '@/lib/types';
import { PortalLogout } from './portal-logout';

export const metadata = { title: 'Đơn hàng của bạn — CREAMEE' };

export default async function PortalOrdersPage() {
  const session = await getSession();
  if (!session || session.role !== 'customer') redirect('/portal/login');

  // Tìm khách hàng theo session userId (chính là customer.id).
  const { rows: customerRows } = await query<{
    id: string; code: string; name: string; phone: string | null;
  }>(
    'SELECT id, code, name, phone FROM customers WHERE id = ? AND is_active = 1 LIMIT 1',
    [session.userId],
  );

  const customer = customerRows[0];

  if (!customer) {
    return (
      <div className="mx-auto max-w-md py-8 text-center">
        <p className="font-medium">Không tìm thấy thông tin khách hàng</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Email đăng nhập chưa được liên kết với khách hàng nào. Vui lòng
          liên hệ CREAMEE.
        </p>
      </div>
    );
  }

  const { rows: orders } = await query<{
    id: string; code: string; order_date: string;
    delivery_date: string | null; total: number;
    status: string; payment_status: string;
  }>(
    `SELECT id, code, order_date, delivery_date, total, status, payment_status
     FROM sales_orders
     WHERE customer_id = ?
     ORDER BY order_date DESC
     LIMIT 100`,
    [customer.id],
  );

  const orderList = orders;
  const totalOutstanding = orderList
    .filter((o) => o.payment_status !== 'paid' && o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Xin chào, {customer.name}</h1>
          <p className="text-sm text-muted-foreground">Mã khách hàng: {customer.code}</p>
        </div>
        <PortalLogout />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tổng số đơn</p>
            <p className="text-lg font-semibold">{orderList.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Còn phải thanh toán</p>
            <p className="text-lg font-semibold text-red-700">{vnd(totalOutstanding)}</p>
          </CardContent>
        </Card>
      </div>

      {orderList.length === 0 ? (
        <div className="rounded-lg border bg-background py-12 text-center text-sm text-muted-foreground">
          Bạn chưa có đơn hàng nào.
        </div>
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Ngày đặt</TableHead>
                <TableHead>Giao hàng</TableHead>
                <TableHead className="text-right">Tổng tiền</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thanh toán</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderList.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.code}</TableCell>
                  <TableCell>{formatDate(o.order_date)}</TableCell>
                  <TableCell>{o.delivery_date ? formatDate(o.delivery_date) : '—'}</TableCell>
                  <TableCell className="text-right font-medium">{vnd(o.total)}</TableCell>
                  <TableCell>
                    <Badge variant={ORDER_STATUS_VARIANT[o.status as OrderStatus]}>
                      {ORDER_STATUS_LABEL[o.status as OrderStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={PAYMENT_STATUS_VARIANT[o.payment_status as PaymentStatus]}>
                      {PAYMENT_STATUS_LABEL[o.payment_status as PaymentStatus]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Mọi thắc mắc về đơn hàng vui lòng liên hệ nhân viên kinh doanh CREAMEE.
      </p>
    </div>
  );
}
