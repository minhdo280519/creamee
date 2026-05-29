/**
 * lib/types.ts — Domain types khớp với schema Postgres.
 * DB dùng snake_case; ở đây giữ snake_case để khớp trực tiếp với
 * kết quả query Supabase (không cần lớp map trung gian).
 */

import type { Role } from './roles';

export type SampleStatus = 'pending' | 'approved' | 'cancelled';

export type OrderStatus =
  | 'draft' | 'pending_approval' | 'approved' | 'processing'
  | 'partial_paid' | 'paid'
  | 'partial_delivered' | 'delivered' | 'completed' | 'cancelled';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';
export type DealStage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type ActivityType = 'call' | 'email' | 'meeting' | 'visit' | 'chat' | 'followup' | 'note';
export type CashAccount = 'main' | 'sub' | 'bank' | 'ewallet';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated';
export type WarehouseMovementType = 'in' | 'out' | 'transfer' | 'adjustment';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  permissions: Record<string, unknown>;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  tax_code: string | null;
  tier: string;
  rfm_score: string | null;
  credit_limit: number;
  payment_terms_days: number;
  total_revenue: number;
  total_orders: number;
  last_order_at: string | null;
  first_order_at: string | null;
  loyalty_points: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  country: string;
  currency: string;
  wechat_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  supplier_id: string;
  so_id: string | null;
  so_code: string | null;
  order_date: string;
  expected_arrival_date: string | null;
  currency: string;
  fx_rate: number;
  subtotal_cny: number;
  shipping_cny: number;
  total_cny: number;
  total_vnd: number;
  paid_cny: number;
  status: string;
  payment_status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Product — cost_cny/cost_vnd là null nếu role không được xem (qua v_products_safe). */
export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  supplier_id: string | null;
  cost_cny: number | null;
  /** Giá vốn landed tổng = goods_cost_vnd + ship_cost_vnd. */
  cost_vnd: number | null;
  /** WAC giá vốn hàng — chưa gồm ship. */
  goods_cost_vnd: number | null;
  /** WAC chi phí ship bình quân mỗi đơn vị. */
  ship_cost_vnd: number | null;
  base_price_vnd: number;
  wholesale_price_vnd: number | null;
  weight_grams: number | null;
  image_urls: string[] | null;
  current_stock: number;
  reorder_point: number;
  reorder_qty: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalesOrder {
  id: string;
  code: string;
  customer_id: string;
  quotation_id: string | null;
  order_date: string;
  delivery_date: string | null;
  delivery_address: string | null;
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  deposit_amount: number;
  delivered_amount: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  notes: string | null;
  loyalty_points_earned: number;
  loyalty_points_redeemed: number;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  delivered_qty: number;
  unit_price: number;
  discount_pct: number;
  line_total: number;
  notes: string | null;
  sort_order: number;
}

export interface SalesOrderWithCustomer extends SalesOrder {
  customer: Pick<Customer, 'id' | 'code' | 'name' | 'phone'> | null;
  creator: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface Deal {
  id: string;
  code: string;
  title: string;
  customer_id: string | null;
  customer_name_snapshot: string | null;
  stage: DealStage;
  estimated_value: number | null;
  probability_pct: number;
  expected_close_date: string | null;
  assigned_to: string | null;
  next_action: string | null;
  next_action_date: string | null;
  lost_reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CashStatus = 'pending' | 'approved' | 'rejected';

export interface CashTransaction {
  id: string;
  code: string;
  transaction_date: string;
  transaction_type: TransactionType;
  account: CashAccount;
  category: string | null;
  amount_vnd: number;
  currency: string;
  payment_method: string;
  reference_type: string | null;
  reference_code: string | null;
  counterparty_name: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  description: string | null;
  status: CashStatus;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface DashboardMetrics {
  orders_today: number;
  revenue_today: number;
  pending_approvals: number;
  low_stock_count: number;
  overdue_ar_count: number;
  total_ar: number;
  total_ap_cny: number;
}

// ── Logistics xuyên biên giới + Landed Cost (0007) ───────────────────

export interface ShippingCarrier {
  id: string;
  name: string;
  contact: string | null;
  rate_cny_per_kg: number;
  min_charge_cny: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Loại chặng vận chuyển — cùng một dạng chi phí. */
export type ShipmentLegType = 'cn_domestic' | 'cn_to_vn' | 'vn_domestic' | 'vn_to_customer';
export type ShipmentPayer = 'ncc_advance' | 'we_pay_now' | 'we_arrange';
export type ShipmentChargeMode = 'per_kg' | 'flat';

/** Một chặng vận chuyển — gộp nhiều dòng PO. */
export interface Shipment {
  id: string;
  code: string;
  tracking_number: string | null;
  so_id: string | null;
  so_code: string | null;
  leg: ShipmentLegType;
  carrier_id: string | null;
  payer: ShipmentPayer;
  charge_mode: ShipmentChargeMode;
  rate_per_kg_cny: number;
  flat_cost: number;
  currency: string;
  fx_rate: number;
  total_weight_kg: number;
  total_cost_vnd: number;
  dispatched_at: string | null;
  arrived_at: string | null;
  delay_status: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Một dòng hàng trong chặng — luôn gắn về một dòng PO. */
export interface ShipmentItem {
  id: string;
  shipment_id: string;
  po_id: string;
  po_item_id: string;
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  weight_kg: number;
  alloc_cost_vnd: number;
  alloc_unit_vnd: number;
  created_at: string;
}

export interface OrderPnL {
  order_id: string;
  order_code: string;
  order_date: string;
  customer_id: string;
  customer_name: string;
  status: OrderStatus;
  revenue: number;
  /** Giá vốn hàng (chưa ship). */
  goods_cogs: number | null;
  /** Chi phí ship phân bổ. */
  ship_cogs: number | null;
  /** Tổng giá vốn landed. */
  total_cogs: number | null;
  /** Lãi gộp trước khi trừ ship. */
  gross_profit_before_ship: number | null;
  /** Lãi gộp sau khi trừ ship. */
  gross_profit: number | null;
  gross_margin_pct: number | null;
}

// ── Product Variants ─────────────────────────────────────────

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  color: string | null;
  size: string | null;
  barcode: string | null;
  cost_cny: number;
  cost_vnd: number;
  price_vnd: number;
  current_stock: number;
  /** JSON array tối đa 10 URL ảnh lưu trên server. */
  image_urls: string[] | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariantWithProduct extends ProductVariant {
  product_name: string;
  product_sku: string;
}

export interface Sample {
  id: string;
  code: string;
  customer_id: string;
  product_id: string | null;
  product_name: string;
  supplier_id: string | null;
  status: SampleStatus;
  deposit_amount: number;
  deposit_paid: number;
  refund_amount: number;
  goods_cost_cny: number;
  goods_cost_vnd: number;
  ship_cost_vnd: number;
  sample_fee_vnd: number;
  other_cost_vnd: number;
  fx_rate: number;
  cumulative_qty_ordered: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SampleWithRelations extends Sample {
  customer: Pick<Customer, 'id' | 'code' | 'name'> | null;
  supplier: Pick<Supplier, 'id' | 'code' | 'name'> | null;
}

export interface MonthlyPnL {
  month: string;
  revenue: number;
  /** Giá vốn hàng (chưa ship). */
  goods_cogs: number | null;
  /** Chi phí ship. */
  ship_cogs: number | null;
  /** Tổng giá vốn landed. */
  cogs: number | null;
  operating_expenses: number | null;
  /** Lãi gộp trước ship. */
  gross_profit_before_ship: number | null;
  /** Lãi gộp sau ship. */
  gross_profit: number | null;
  net_profit: number | null;
}
