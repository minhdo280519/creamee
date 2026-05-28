import type { OrderStatus, PaymentStatus } from '@/lib/types';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline';

/** Nhãn tiếng Việt cho trạng thái đơn bán. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'Nháp',
  pending_approval: 'Chờ duyệt',
  approved: 'Đã duyệt',
  processing: 'Đang xử lý',
  partial_paid: 'Thanh toán một phần',
  paid: 'Đã thanh toán',
  partial_delivered: 'Giao một phần',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
};

export const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  draft: 'secondary',
  pending_approval: 'warning',
  approved: 'default',
  processing: 'warning',
  partial_paid: 'warning',
  paid: 'success',
  partial_delivered: 'warning',
  delivered: 'success',
  completed: 'success',
  cancelled: 'destructive',
};

/** Nhãn tiếng Việt cho trạng thái thanh toán. */
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Chưa thu',
  partial: 'Thu một phần',
  paid: 'Đã thu đủ',
  overpaid: 'Thu vượt',
};

export const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, BadgeVariant> = {
  unpaid: 'destructive',
  partial: 'warning',
  paid: 'success',
  overpaid: 'secondary',
};

/** Các chuyển trạng thái hợp lệ — state machine đơn bán. */
export const ORDER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  draft: ['pending_approval', 'approved', 'cancelled'],
  pending_approval: ['approved', 'cancelled'],
  approved: ['processing', 'partial_delivered', 'delivered', 'completed', 'cancelled'],
  processing: ['partial_delivered', 'delivered', 'completed', 'cancelled'],
  partial_delivered: ['delivered', 'completed', 'cancelled'],
  delivered: ['completed'],
  partial_paid: ['paid', 'completed'],
  paid: ['completed'],
};
