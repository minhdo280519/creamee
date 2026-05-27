'use client';

import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { Moon, Sun, LogOut, User, ChevronDown } from 'lucide-react';
import { signOut } from '@/app/login/actions';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, ROLE_BADGE, type Role } from '@/lib/roles';
import { NAV_TREE } from '@/lib/nav';

interface TopbarProps {
  fullName: string;
  email: string;
  role: Role;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(-2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function usePageTitle(): { section: string; page: string } {
  const pathname = usePathname();
  for (const sec of NAV_TREE) {
    if (sec.href && pathname.startsWith(sec.href)) {
      return { section: '', page: sec.label };
    }
    for (const item of sec.items ?? []) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        return { section: sec.label, page: item.label };
      }
    }
  }
  return { section: '', page: 'CREAMEE ERP' };
}

const AVATAR_COLORS: Record<Role, string> = {
  owner: 'bg-violet-500',
  accountant_lead: 'bg-blue-500',
  accountant: 'bg-sky-500',
  hr: 'bg-pink-500',
  manager: 'bg-amber-500',
  sales: 'bg-green-500',
  warehouse: 'bg-orange-500',
  customer: 'bg-teal-500',
};

export function Topbar({ fullName, email, role }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const { section, page } = usePageTitle();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6">
      {/* Breadcrumb / Page title */}
      <div className="flex items-center gap-2 min-w-0">
        {section ? (
          <>
            <span className="hidden truncate text-sm text-muted-foreground sm:block">{section}</span>
            <span className="hidden text-muted-foreground/50 sm:block">/</span>
            <span className="truncate text-sm font-semibold text-foreground">{page}</span>
          </>
        ) : (
          <span className="truncate text-sm font-semibold text-foreground">{page}</span>
        )}
      </div>

      {/* Right actions */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Đổi giao diện sáng/tối"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 rounded-lg px-2 hover:bg-accent">
              <Avatar className={cn('h-7 w-7 text-white text-xs font-semibold', AVATAR_COLORS[role] ?? 'bg-primary')}>
                <AvatarFallback className={cn('text-white text-xs font-semibold', AVATAR_COLORS[role] ?? 'bg-primary')}>
                  {initials(fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold leading-tight">{fullName.split(' ').slice(-1)[0]}</p>
              </div>
              <ChevronDown className="hidden h-3 w-3 opacity-50 sm:block" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="pb-2">
              <div className="flex items-center gap-3">
                <Avatar className={cn('h-9 w-9', AVATAR_COLORS[role] ?? 'bg-primary')}>
                  <AvatarFallback className={cn('text-white text-sm font-semibold', AVATAR_COLORS[role] ?? 'bg-primary')}>
                    {initials(fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <span className="truncate text-sm font-semibold">{fullName}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
                  <Badge className={cn('mt-0.5 w-fit px-1.5 py-0 text-[10px]', ROLE_BADGE[role])}>
                    {ROLE_LABELS[role]}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <form action={signOut} className="w-full">
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full flex items-center cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Đăng xuất
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

