import type { EntitySchema } from '@/lib/schema-form';

/** Schema entity Sản phẩm. */
export const productSchema: EntitySchema = {
  name: 'products',
  label: 'sản phẩm',
  table: 'products',
  fields: [
    {
      name: 'sku',
      label: 'Mã SKU',
      type: 'text',
      required: true,
      sortable: true,
      placeholder: 'VD: AO-LEN-001',
    },
    {
      name: 'name',
      label: 'Tên sản phẩm',
      type: 'text',
      required: true,
      sortable: true,
      placeholder: 'VD: Áo len cổ lọ',
    },
    {
      name: 'category',
      label: 'Danh mục',
      type: 'text',
      sortable: true,
      placeholder: 'VD: Áo len',
    },
    {
      name: 'supplier_id',
      label: 'Nhà cung cấp',
      type: 'relation',
      inTable: false,
      relation: { entity: 'suppliers', entityLabel: 'nhà cung cấp' },
      placeholder: 'Chọn hoặc tạo NCC',
    },
    {
      name: 'base_price_vnd',
      label: 'Giá bán lẻ',
      type: 'currency',
      required: true,
      sortable: true,
    },
    {
      name: 'wholesale_price_vnd',
      label: 'Giá bán sỉ',
      type: 'currency',
      sortable: true,
    },
    {
      name: 'weight_grams',
      label: 'Trọng lượng (gram)',
      type: 'number',
      inTable: false,
      hint: 'Dùng để phân bổ chi phí ship',
    },
    {
      name: 'current_stock',
      label: 'Tồn kho',
      type: 'number',
      readOnly: true,
      sortable: true,
      hint: 'Tự cập nhật theo nhập/xuất kho',
    },
    {
      name: 'reorder_point',
      label: 'Ngưỡng cảnh báo',
      type: 'number',
      inTable: false,
      hint: 'Tồn dưới mức này sẽ cảnh báo',
    },
    {
      name: 'reorder_qty',
      label: 'SL đặt lại',
      type: 'number',
      inTable: false,
    },
    {
      name: 'image_url',
      label: 'URL Ảnh sản phẩm',
      type: 'text',
      inTable: false,
      placeholder: 'https://... (để trống nếu chưa có)',
    },
    {
      name: 'description',
      label: 'Mô tả',
      type: 'textarea',
      inTable: false,
    },
    {
      name: 'is_active',
      label: 'Đang kinh doanh',
      type: 'switch',
      inTable: false,
      defaultValue: true,
    },
  ],
};

/**
 * Schema rút gọn cho role KHÔNG được xem giá vốn — ẩn các field nhạy cảm.
 * (cost_cny/cost_vnd vốn không có trong form; đây để chắc chắn.)
 */
export const productSchemaNoCost = productSchema;
