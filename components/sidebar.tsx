'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Truck, Package, Wallet, Settings,
  Users, Store, TrendingUp, BoxIcon, BarChart3, DollarSign, UserPlus,
  PiggyBank,
  ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_TREE, type NavSection } from '@/lib/nav';
import { canAccessRoute, type Role } from '@/lib/roles';

const SECTION_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, ShoppingCart, Truck, Package, Wallet, Settings,
};

const ITEM_ICONS: Record<string, LucideIcon> = {
  '/sales-orders': ShoppingCart,
  '/customers': Users,
  '/leads': UserPlus,
  '/deals': TrendingUp,
  '/purchase-orders': Truck,
  '/suppliers': Store,
  '/logistics': BoxIcon,
  '/products': Package,
  '/inventory-lots': BoxIcon,
  '/cash': DollarSign,
  '/ar-ap': BarChart3,
  '/overhead': PiggyBank,
  '/analytics': BarChart3,
  '/hr': Users,
  '/ai': Settings,
  '/users': Users,
  '/settings': Settings,
};

interface SidebarProps {
  role: Role;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [openSections, setOpenSections] = React.useState<Set<string>>(() => {
    const initial = new Set<string>();
    NAV_TREE.forEach((s) => {
      if (s.items?.some((i) => pathname.startsWith(i.href))) {
        initial.add(s.key);
      }
    });
    return initial;
  });

  const tree: NavSection[] = React.useMemo(() => {
    return NAV_TREE.map((section) => {
      if (section.href) {
        return canAccessRoute(role, section.href) ? section : null;
      }
      const items = (section.items ?? []).filter((i) => canAccessRoute(role, i.href));
      return items.length > 0 ? { ...section, items } : null;
    }).filter((s): s is NavSection => s !== null);
  }, [role]);

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <aside
      className={cn(
        'relative hidden md:flex flex-col h-full border-r bg-card transition-all duration-300 ease-in-out',
        collapsed ? 'w-[68px]' : 'w-[240px]',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center border-b px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            C
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="truncate text-sm font-bold tracking-tight text-foreground">CREAMEE</p>
              <p className="truncate text-[10px] text-muted-foreground">ERP v7.0</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {tree.map((section) => {
          const Icon = SECTION_ICONS[section.icon] ?? LayoutDashboard;
          const isCurrentSection = section.href
            ? pathname.startsWith(section.href)
            : section.items?.some((i) => pathname.startsWith(i.href));
          const isOpen = openSections.has(section.key);

          /* ── Mục đơn (Dashboard) ── */
          if (section.href) {
            return (
              <Link
                key={section.key}
                href={section.href}
                title={collapsed ? section.label : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isCurrentSection
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{section.label}</span>}
              </Link>
            );
          }

          /* ── Mục có con ── */
          return (
            <div key={section.key}>
              <button
                type="button"
                onClick={() => { if (!collapsed) toggleSection(section.key); }}
                title={collapsed ? section.label : undefined}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isCurrentSection && !isOpen
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate text-left">{section.label}</span>
                    {isOpen
                      ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      : <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    }
                  </>
                )}
              </button>

              {/* Sub-items */}
              {!collapsed && isOpen && (
                <ul className="mb-1 ml-3 mt-0.5 space-y-0.5 border-l border-border/60 pl-3">
                  {section.items?.map((item) => {
                    const ItemIcon = ITEM_ICONS[item.href];
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors',
                            active
                              ? 'bg-primary/10 font-medium text-primary'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          {ItemIcon && <ItemIcon className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 border-t p-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {collapsed
            ? <PanelLeftOpen className="h-4 w-4 shrink-0" />
            : <><PanelLeftClose className="h-4 w-4 shrink-0" /><span className="text-xs">Thu gọn</span></>
          }
        </button>
      </div>
    </aside>
  );
}
