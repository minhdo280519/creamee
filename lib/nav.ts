/**
 * lib/nav.ts — Menu sidebar phân cấp 2 tầng kiểu Odoo / QuickBooks.
 *
 * Tầng 1 (NavSection): nhóm lớn có icon, bấm để mở/đóng.
 * Tầng 2 (NavItem): mục con dẫn tới 1 route trong ROUTE_ACCESS.
 *
 * Sidebar lọc tự động: chỉ hiện mục con mà role hiện tại được vào;
 * nếu cả nhóm không còn mục nào, nhóm tự ẩn.
 */

export interface NavItem {
  /** Path — phải khớp key trong ROUTE_ACCESS (lib/roles.ts). */
  href: string;
  label: string;
}

export interface NavSection {
  /** Khoá nhóm — dùng lưu trạng thái mở/đóng. */
  key: string;
  label: string;
  /** Tên icon lucide-react cho nhóm. */
  icon: string;
  /** Mục đơn (không có con) — VD Bảng điều khiển. */
  href?: string;
  /** Mục con. Bỏ trống nếu nhóm là mục đơn. */
  items?: NavItem[];
}

/** Cây menu — tầng 1 là section, tầng 2 là item. */
export const NAV_TREE: NavSection[] = [
  {
    key: 'dashboard',
    label: 'Bảng điều khiển',
    icon: 'LayoutDashboard',
    href: '/dashboard',
  },
  {
    key: 'sales',
    label: 'Bán hàng',
    icon: 'ShoppingCart',
    items: [
      { href: '/sales-orders', label: 'Đơn bán hàng' },
      { href: '/customers', label: 'Khách hàng' },
      { href: '/deals', label: 'Cơ hội bán hàng' },
    ],
  },
  {
    key: 'purchase',
    label: 'Mua hàng',
    icon: 'Truck',
    items: [
      { href: '/purchase-orders', label: 'Đơn nhập hàng' },
      { href: '/suppliers', label: 'Nhà cung cấp' },
      { href: '/logistics', label: 'Vận chuyển & Chi phí' },
      { href: '/samples', label: 'Quản lý mẫu' },
    ],
  },
  {
    key: 'inventory',
    label: 'Kho hàng',
    icon: 'Package',
    items: [
      { href: '/products', label: 'Sản phẩm' },
      { href: '/inventory-lots', label: 'Tồn kho theo lô' },
      { href: '/warehouse', label: 'Nhập/Xuất kho' },
    ],
  },
  {
    key: 'finance',
    label: 'Kế toán',
    icon: 'Wallet',
    items: [
      { href: '/cash', label: 'Thu chi tiền mặt' },
      { href: '/ar-ap', label: 'Công nợ' },
      { href: '/analytics', label: 'Báo cáo & Phân tích' },
    ],
  },
  {
    key: 'system',
    label: 'Hệ thống',
    icon: 'Settings',
    items: [
      { href: '/ai', label: 'Trợ lý AI' },
      { href: '/users', label: 'Người dùng' },
      { href: '/settings', label: 'Cài đặt' },
    ],
  },
];

/** Toàn bộ route phẳng — tiện cho việc kiểm tra/tra cứu. */
export const ALL_NAV_ROUTES: string[] = NAV_TREE.flatMap((s) =>
  s.href ? [s.href] : (s.items ?? []).map((i) => i.href),
);
