import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Gộp class Tailwind, xử lý conflict. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format số tiền VND: 1500000 → "1.500.000 ₫" */
export function vnd(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' ₫';
}

/** Format số tiền CNY: 1250.5 → "¥1.250,50" */
export function cny(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return '¥' + new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2 }).format(amount);
}

/** Format số nguyên: 12345 → "12.345" */
export function num(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(value);
}

/** Format ngày: "2026-05-22" → "22/05/2026" */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Format ngày giờ: → "22/05/2026 14:30" */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Phần trăm: 0.05 → "5%" */
export function pct(value: number | null | undefined): string {
  if (value == null) return '—';
  return (value * 100).toFixed(value * 100 % 1 === 0 ? 0 : 1) + '%';
}

/** Bỏ dấu tiếng Việt — dùng cho search & sinh mã KH. */
export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Số ngày giữa 2 mốc thời gian. */
export function daysBetween(from: string | Date, to: string | Date = new Date()): number {
  const a = typeof from === 'string' ? new Date(from) : from;
  const b = typeof to === 'string' ? new Date(to) : to;
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

/** debounce đơn giản cho input search. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delay = 300,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
