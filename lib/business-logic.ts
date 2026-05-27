/**
 * lib/business-logic.ts
 * Port nguyên văn các công thức từ CREAMEE_BUSINESS_LOGIC.md.
 * Đây là phần BẤT BIẾN — UI đổi được, công thức thì không.
 */

// ── Mục 2: SALES ORDER — tính tiền ───────────────────────────────────

export interface OrderLineInput {
  qtyOrdered: number;
  unitPrice: number;
  /** Số thập phân: 0.05 = 5%. */
  lineDiscountPercent: number;
}

/** calcLineTotal — thành tiền 1 dòng sản phẩm. */
export function calcLineTotal(item: OrderLineInput): number {
  return item.qtyOrdered * item.unitPrice * (1 - item.lineDiscountPercent);
}

export interface OrderDiscount {
  value: number;
  type: 'percent' | 'fixed';
}

export interface OrderTotalResult {
  subTotal: number;
  discountAmount: number;
  total: number;
}

/** calcOrderTotal — tổng đơn sau chiết khấu + phụ phí. total không bao giờ âm. */
export function calcOrderTotal(
  items: OrderLineInput[],
  orderDiscount: OrderDiscount,
  orderFee: number,
): OrderTotalResult {
  const subTotal = items.reduce((s, it) => s + calcLineTotal(it), 0);
  const discountAmount =
    orderDiscount.type === 'percent'
      ? subTotal * (orderDiscount.value / 100)
      : orderDiscount.value;
  const total = Math.max(0, subTotal - discountAmount + orderFee);
  return { subTotal, discountAmount, total };
}

/** checkApprovalNeeded — đơn vượt ngưỡng cần Manager duyệt. */
export function checkApprovalNeeded(orderTotal: number, threshold = 50_000_000): boolean {
  return orderTotal > threshold;
}

// ── Mục 3: CREDIT LIMIT ──────────────────────────────────────────────

export interface CreditCheckResult {
  ok: boolean;
  currentDebt?: number;
  creditLimit?: number;
  message?: string;
}

/** checkCreditLimit — kiểm tra hạn mức công nợ KH. */
export function checkCreditLimit(
  creditLimit: number,
  currentDebt: number,
  newOrderAmount: number,
): CreditCheckResult {
  if (creditLimit <= 0) return { ok: true }; // KH không giới hạn
  const projectedTotal = currentDebt + newOrderAmount;
  if (projectedTotal > creditLimit) {
    return {
      ok: false,
      currentDebt,
      creditLimit,
      message:
        `KH vượt hạn mức. Nợ ${currentDebt.toLocaleString('vi-VN')} + ` +
        `đơn mới ${newOrderAmount.toLocaleString('vi-VN')} = ` +
        `${projectedTotal.toLocaleString('vi-VN')} > Limit ${creditLimit.toLocaleString('vi-VN')}`,
    };
  }
  return { ok: true, currentDebt, creditLimit };
}

// ── Mục 4: STOCK ─────────────────────────────────────────────────────

export interface StockCheckItem {
  productName: string;
  qtyOrdered: number;
  stock: number;
}

/** checkStock — trả mảng cảnh báo (rỗng nếu đủ hàng). Thiếu hàng chỉ CẢNH BÁO. */
export function checkStock(items: StockCheckItem[]): string[] {
  const warnings: string[] = [];
  items.forEach((it, idx) => {
    if (it.qtyOrdered > it.stock && it.stock > 0) {
      warnings.push(
        `Dòng ${idx + 1} (${it.productName}): cần ${it.qtyOrdered} nhưng kho chỉ ${it.stock}`,
      );
    }
  });
  return warnings;
}

// ── Mục 5: PURCHASE ORDER — tính tiền CNY ────────────────────────────

export interface POLineInput {
  qty: number;
  unitPriceCNY: number;
  otherFeeCNY: number;
}

export function calcPOLineTotal(item: POLineInput, tyGia: number) {
  const totalCNY = item.qty * item.unitPriceCNY + item.otherFeeCNY;
  return { totalCNY, totalVND: totalCNY * tyGia };
}

export function calcPOTotal(items: POLineInput[], tyGia: number) {
  const totalCNY = items.reduce(
    (s, it) => s + it.qty * it.unitPriceCNY + it.otherFeeCNY,
    0,
  );
  return { totalCNY, totalVND: totalCNY * tyGia };
}

// ── Mục 6: LOGISTICS ─────────────────────────────────────────────────
// Mô hình vận chuyển đã chuyển sang "mỗi chặng = 1 bản ghi" (migration
// 0008). Logic phân bổ chi phí theo kg nằm ở lib/landed-cost.ts; logic
// SQL ở supabase/migrations/0008_shipment_legs.sql.

// ── Mục 7: COMMISSION ────────────────────────────────────────────────

export interface CommissionResult {
  commissionAmount: number;
  installment1: number;
  installment2: number;
}

/** computeCommission — hoa hồng cho 1 đơn đã giao + đã thu đủ. */
export function computeCommission(orderTotal: number, rate: number): CommissionResult {
  const commissionAmount = orderTotal * rate;
  return {
    commissionAmount,
    installment1: commissionAmount * 0.5,
    installment2: commissionAmount * 0.5,
  };
}

// ── Mục 1: AUTO-GENERATE CODES ───────────────────────────────────────

/** genCustomerCode — 4 ký tự đầu tên (không dấu, hoa) + seq 3 số. */
export function genCustomerCode(name: string, totalCustomers: number): string {
  const namePart = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, '')
    .toUpperCase()
    .slice(0, 4);
  return namePart + String(totalCustomers + 1).padStart(3, '0');
}
