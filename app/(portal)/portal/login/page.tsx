import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PortalLoginForm } from './login-form';

export const metadata = { title: 'Đăng nhập — Cổng khách hàng CREAMEE' };

export default function PortalLoginPage() {
  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle>Tra cứu đơn hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <PortalLoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
