'use client';

import * as React from 'react';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { sendPortalMagicLink } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PortalLoginForm() {
  const [email, setEmail] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit() {
    if (!email.trim()) {
      setError('Vui lòng nhập email');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const r = await sendPortalMagicLink(email);
      if (!r.ok) {
        setError(r.error ?? 'Gửi link thất bại');
        return;
      }
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mb-3 flex justify-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        </div>
        <p className="mb-1 font-medium">Đã gửi link đăng nhập</p>
        <p className="text-sm text-muted-foreground">
          Vui lòng kiểm tra hộp thư <strong>{email}</strong> và bấm vào link
          để truy cập đơn hàng.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email đã đăng ký</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="email@cuaban.com"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={handleSubmit} disabled={sending} className="w-full">
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        Gửi link đăng nhập
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Bạn sẽ nhận được một link đăng nhập an toàn qua email. Không cần
        mật khẩu.
      </p>
    </div>
  );
}
