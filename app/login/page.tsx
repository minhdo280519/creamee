import { LoginForm } from './login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Đăng nhập — CREAMEE ERP' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">CREAMEE</h1>
          <p className="text-sm text-muted-foreground">Hệ thống quản lý doanh nghiệp</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Đăng nhập</CardTitle>
            <CardDescription>Nhập thông tin tài khoản nội bộ của bạn.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          CREAMEE ERP v7.0 • Liên hệ quản trị viên nếu quên mật khẩu
        </p>
      </div>
    </div>
  );
}
