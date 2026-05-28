/**
 * lib/roles.ts — Single source of truth cho phân quyền (TypeScript side).
 *
 * Các helper ở đây PHẢI khớp logic với các SQL function trong
 * 0005_roles_v7.sql (can_view_cost, can_approve_order, ...).
 * UI dùng để ẩn/hiện nút; backend RLS mới là lớp chặn thật sự.
 */

export const ROLES = [
  'owner',
  'accountant_lead',
  'accountant',
  'hr',
  'manager',
  'sales',
  'warehouse',
  'customer',
] as const;

export type Role = (typeof ROLES)[number];

/** 7 role nhân viên (không tính customer). */
export const STAFF_ROLES = ROLES.filter((r) => r !== 'customer');

/** Nhãn tiếng Việt để render trong UI. */
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Chủ',
  accountant_lead: 'Kế toán trưởng',
  accountant: 'Kế toán viên',
  hr: 'Nhân sự',
  manager: 'Quản lý',
  sales: 'Nhân viên bán hàng',
  warehouse: 'Kho',
  customer: 'Khách hàng',
};

/** Màu badge gợi ý cho mỗi role (Tailwind class). */
export const ROLE_BADGE: Record<Role, string> = {
  owner: 'bg-amber-100 text-amber-800',
  accountant_lead: 'bg-emerald-100 text-emerald-800',
  accountant: 'bg-emerald-50 text-emerald-700',
  hr: 'bg-violet-100 text-violet-800',
  manager: 'bg-blue-100 text-blue-800',
  sales: 'bg-sky-100 text-sky-800',
  warehouse: 'bg-orange-100 text-orange-800',
  customer: 'bg-gray-100 text-gray-700',
};

// ── Permission helpers — khớp 1:1 với SQL functions ──────────────────

export const isStaff = (r: Role): boolean => r !== 'customer';

export const isOwner = (r: Role): boolean => r === 'owner';

export const isManagement = (r: Role): boolean =>
  r === 'owner' || r === 'manager';

export const isFinance = (r: Role): boolean =>
  r === 'owner' || r === 'accountant_lead' || r === 'accountant';

/** can_view_cost() — sale, kho, nhân sự KHÔNG thấy giá vốn/lợi nhuận. */
export const canViewCost = (r: Role, canViewProfitFlag = false): boolean =>
  r === 'owner' ||
  r === 'manager' ||
  r === 'accountant_lead' ||
  r === 'accountant' ||
  canViewProfitFlag;

/** can_approve_order() — Chủ + Manager + Kế toán trưởng. */
export const canApproveOrder = (r: Role): boolean =>
  r === 'owner' || r === 'manager' || r === 'accountant_lead';

/** can_approve_cash() — Chủ + Kế toán trưởng tự duyệt; KT viên chờ duyệt. */
export const canApproveCash = (r: Role): boolean =>
  r === 'owner' || r === 'accountant_lead';

/** Quản lý user (tạo/sửa nhân viên) — Chủ + Nhân sự. */
export const canManageUsers = (r: Role): boolean =>
  r === 'owner' || r === 'hr';

/** Quản lý NCC + Purchase Order — Chủ + Manager + Kho. */
export const canManagePurchasing = (r: Role): boolean =>
  r === 'owner' || r === 'manager' || r === 'warehouse';

/**
 * Trang nào role nào vào được — dùng để build sidebar động + middleware.
 * Key = path prefix, value = danh sách role được phép.
 */
const KT = ['accountant_lead', 'accountant'] as const;

export const ROUTE_ACCESS: Record<string, Role[]> = {
  '/dashboard':      [...STAFF_ROLES],
  '/customers':      ['owner', 'manager', 'sales', ...KT],
  '/products':       [...STAFF_ROLES],
  '/inventory-lots': ['owner', 'manager', 'warehouse', ...KT],
  '/suppliers':      ['owner', 'manager', 'warehouse', ...KT],
  '/quotations':     ['owner', 'manager', 'sales', ...KT],
  '/sales-orders':   ['owner', 'manager', 'sales', ...KT],
  '/purchase-orders':['owner', 'manager', 'warehouse', ...KT],
  '/warehouse':      ['owner', 'manager', 'warehouse', ...KT],
  '/logistics':      ['owner', 'manager', 'warehouse', ...KT],
  '/samples':        ['owner', 'manager', 'warehouse', 'sales', ...KT],
  '/cash':           ['owner', 'manager', ...KT],
  '/ar-ap':          ['owner', 'manager', ...KT],
  '/deals':          ['owner', 'manager', 'sales', ...KT],
  '/activities':     ['owner', 'manager', 'sales', ...KT],
  '/analytics':      ['owner', 'manager', ...KT],
  '/ai':             [...STAFF_ROLES],
  '/users':          ['owner', 'hr'],
  '/settings':       ['owner'],
};

/** Kiểm tra role có vào được path không (so khớp prefix dài nhất). */
export function canAccessRoute(role: Role, pathname: string): boolean {
  const matches = Object.keys(ROUTE_ACCESS)
    .filter((p) => pathname === p || pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length);
  const match = matches[0];
  if (!match) return isStaff(role); // path chưa khai báo → mặc định cho nhân viên
  return (ROUTE_ACCESS[match] ?? []).includes(role);
}
