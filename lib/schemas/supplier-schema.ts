import type { EntitySchema } from '@/lib/schema-form';

/** Schema entity Nhà cung cấp (Trung Quốc). */
export const supplierSchema: EntitySchema = {
  name: 'suppliers',
  label: 'nhà cung cấp',
  table: 'suppliers',
  fields: [
    { name: 'code', label: 'Mã NCC', type: 'text', readOnly: true, sortable: true, placeholder: 'Tự động' },
    { name: 'name', label: 'Tên NCC', type: 'text', required: true, sortable: true, placeholder: 'VD: Xưởng len Quảng Châu' },
    { name: 'contact_person', label: 'Người liên hệ', type: 'text', sortable: true },
    { name: 'phone', label: 'Điện thoại', type: 'phone' },
    { name: 'wechat_id', label: 'WeChat ID', type: 'text' },
    { name: 'email', label: 'Email', type: 'email', inTable: false },
    { name: 'address', label: 'Địa chỉ', type: 'text', inTable: false },
    {
      name: 'country', label: 'Quốc gia', type: 'select', defaultValue: 'CN', inTable: false,
      options: [
        { value: 'CN', label: 'Trung Quốc' },
        { value: 'VN', label: 'Việt Nam' },
        { value: 'KR', label: 'Hàn Quốc' },
        { value: 'other', label: 'Khác' },
      ],
    },
    {
      name: 'currency', label: 'Tiền tệ', type: 'select', defaultValue: 'CNY', inTable: false,
      options: [
        { value: 'CNY', label: 'CNY (¥)' },
        { value: 'USD', label: 'USD ($)' },
        { value: 'VND', label: 'VND (₫)' },
      ],
    },
    { name: 'notes', label: 'Ghi chú', type: 'textarea', inTable: false },
    { name: 'is_active', label: 'Đang hợp tác', type: 'switch', inTable: false, defaultValue: true },
  ],
};
