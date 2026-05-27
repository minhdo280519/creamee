import type { Metadata } from 'next';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'CREAMEE — Cổng khách hàng',
  description: 'Tra cứu đơn hàng và công nợ',
};

/**
 * Layout cổng khách hàng — tách biệt hoàn toàn với ERP nội bộ.
 * Không sidebar nội bộ, giao diện tối giản.
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            C
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">CREAMEE</p>
            <p className="text-xs text-muted-foreground">Cổng khách hàng</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      <Toaster position="top-center" />
    </div>
  );
}
