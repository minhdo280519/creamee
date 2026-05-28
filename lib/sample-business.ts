import type { SampleStatus } from './types';

/** Tính refund tối đa có thể hoàn (theo business rule).
 * - cancel → 0 (mất cọc)
 * - approve + ≥200 cái → hoàn 1,000,000
 * - approve + ≥500 cái → hoàn full (toàn bộ deposit_amount)
 */
export function calcMaxRefund(
  status: SampleStatus,
  depositAmount: number,
  cumulativeQty: number,
): number {
  if (status === 'cancelled') return 0;
  if (status !== 'approved') return 0;
  if (cumulativeQty >= 500) return depositAmount;
  if (cumulativeQty >= 200) return 1_000_000;
  return 0;
}
