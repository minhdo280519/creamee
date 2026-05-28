/**
 * lib/landed-cost.ts — Mirror client-side của logic phân bổ chi phí
 * vận chuyển (migration 0008). Dùng để xem trước (preview) realtime
 * trong form trước khi lưu; con số khớp với trigger SQL.
 *
 * MÔ HÌNH: mỗi "chặng" (leg) là một lần vận chuyển độc lập.
 *   - cn_domestic : nội địa Trung Quốc
 *   - cn_to_vn    : Trung Quốc → Hà Nội
 *   - vn_domestic : nội địa Việt Nam (Hà Nội → HCM...)
 * Cả ba đều CÙNG một dạng chi phí, phân bổ theo trọng lượng (kg).
 */

export type ShipmentLeg = 'cn_domestic' | 'cn_to_vn' | 'vn_domestic' | 'vn_to_customer';
export type ChargeMode = 'per_kg' | 'flat';

/** Một dòng hàng trong chặng. */
export interface LegLineInput {
  /** Khoá React/tạm thời. */
  key: string;
  productName: string;
  quantity: number;
  /** Trọng lượng thực cả dòng (kg). */
  weightKg: number;
  /** Giá trị hàng của dòng, quy về VND (chưa gồm ship). */
  goodsCostVnd: number;
}

/** Tham số chi phí của chặng. */
export interface LegCostInput {
  chargeMode: ChargeMode;
  /** per_kg: đơn giá theo kg (đơn vị: currency bên dưới). */
  ratePerKg: number;
  /** flat: phí trọn gói (đơn vị: currency). */
  flatCost: number;
  /** Tỷ giá quy đổi currency → VND (VND thì = 1). */
  fxRate: number;
}

/** Kết quả phân bổ cho một dòng. */
export interface AllocatedLine {
  key: string;
  productName: string;
  quantity: number;
  weightKg: number;
  goodsCostVnd: number;
  /** Phần chi phí chặng phân bổ cho dòng này (VND). */
  allocCostVnd: number;
  /** Chi phí ship phân bổ trên mỗi đơn vị. */
  allocUnitVnd: number;
  /** Giá vốn dòng sau chặng này (hàng + ship). */
  landedCostVnd: number;
  /** Giá vốn trên mỗi đơn vị. */
  landedUnitCostVnd: number;
}

export interface LegAllocationResult {
  lines: AllocatedLine[];
  totalWeightKg: number;
  /** Tổng chi phí của chặng (VND). */
  totalCostVnd: number;
}

/**
 * Phân bổ chi phí MỘT chặng về từng dòng theo tỷ trọng kg.
 * Dòng nặng gánh nhiều hơn → hàng nhẹ ship rẻ hơn (tự nhiên).
 */
export function allocateLegCost(
  lines: LegLineInput[],
  cost: LegCostInput,
): LegAllocationResult {
  const totalWeightKg = lines.reduce((s, l) => s + (l.weightKg || 0), 0);

  // Tổng chi phí chặng (quy về VND).
  const totalCostVnd =
    cost.chargeMode === 'per_kg'
      ? Math.round(totalWeightKg * cost.ratePerKg * cost.fxRate)
      : Math.round(cost.flatCost * cost.fxRate);

  const allocated: AllocatedLine[] = lines.map((l) => {
    const alloc =
      totalWeightKg > 0
        ? Math.round(totalCostVnd * (l.weightKg / totalWeightKg))
        : 0;
    const landed = l.goodsCostVnd + alloc;
    return {
      key: l.key,
      productName: l.productName,
      quantity: l.quantity,
      weightKg: l.weightKg,
      goodsCostVnd: l.goodsCostVnd,
      allocCostVnd: alloc,
      allocUnitVnd: l.quantity > 0 ? alloc / l.quantity : 0,
      landedCostVnd: landed,
      landedUnitCostVnd: l.quantity > 0 ? landed / l.quantity : 0,
    };
  });

  return { lines: allocated, totalWeightKg, totalCostVnd };
}

/** Nhãn tiếng Việt cho loại chặng. */
export const LEG_LABEL: Record<ShipmentLeg, string> = {
  cn_domestic: 'Nội địa Trung Quốc',
  cn_to_vn: 'Trung Quốc → Việt Nam',
  vn_domestic: 'Nội địa Việt Nam',
  vn_to_customer: 'Giao hàng tới khách',
};

/** Mô tả ngắn cho mỗi loại chặng. */
export const LEG_HINT: Record<ShipmentLeg, string> = {
  cn_domestic: 'NCC → kho gom tại Trung Quốc',
  cn_to_vn: 'Kho TQ → Hà Nội, thường tính theo kg',
  vn_domestic: 'Hà Nội → HCM hoặc kho khác',
  vn_to_customer: 'Kho → địa chỉ khách hàng, gắn theo đơn bán',
};

/**
 * WAC tách đôi — bình quân gia quyền RIÊNG cho tiền hàng và ship.
 * Trả về 2 con số để báo cáo phân biệt lãi gộp trước/sau ship.
 */
export interface SplitWac {
  /** WAC giá vốn hàng (chưa ship). */
  goodsWac: number;
  /** WAC chi phí ship trên mỗi đơn vị. */
  shipWac: number;
  /** Tổng landed = goodsWac + shipWac. */
  totalWac: number;
}

export function computeSplitWac(
  entries: { quantity: number; goodsCostVnd: number; shipCostVnd: number }[],
): SplitWac {
  const totalQty = entries.reduce((s, e) => s + e.quantity, 0);
  if (totalQty === 0) return { goodsWac: 0, shipWac: 0, totalWac: 0 };

  const goodsTotal = entries.reduce((s, e) => s + e.goodsCostVnd, 0);
  const shipTotal = entries.reduce((s, e) => s + e.shipCostVnd, 0);
  const goodsWac = goodsTotal / totalQty;
  const shipWac = shipTotal / totalQty;
  return { goodsWac, shipWac, totalWac: goodsWac + shipWac };
}

/**
 * WAC gộp (giữ tương thích) — tổng landed cost / tổng số lượng.
 */
export function computeWac(
  entries: { quantity: number; landedCostVnd: number }[],
): number {
  const totalQty = entries.reduce((s, e) => s + e.quantity, 0);
  const totalCost = entries.reduce((s, e) => s + e.landedCostVnd, 0);
  return totalQty > 0 ? totalCost / totalQty : 0;
}
