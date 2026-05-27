'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { portalSignOut } from '@/app/(portal)/portal/actions';

export function PortalLogout() {
  const router = useRouter();

  async function handleLogout() {
    await portalSignOut();
    router.push('/portal/login');
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout}>
      <LogOut className="h-3.5 w-3.5" />
      Đăng xuất
    </Button>
  );
}
