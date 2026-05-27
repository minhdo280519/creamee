import { requireUser } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import type { Role } from '@/lib/roles';

/**
 * Layout cho toàn bộ trang đã đăng nhập.
 * requireUser() chặn truy cập nếu chưa login.
 * Sidebar + Topbar nhận role để render menu động.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role as Role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          fullName={profile.full_name}
          email={profile.email}
          role={profile.role as Role}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
