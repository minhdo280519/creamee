/**
 * lib/schema-form.ts — TRỤ CỘT AUTOMATION #2.
 *
 * Định nghĩa schema 1 lần → form + table tự generate.
 * Không hard-code form/table cho từng entity.
 */

import { z } from 'zod';

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'currency' | 'email' | 'phone'
  | 'select' | 'switch' | 'date' | 'relation';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldSchema {
  /** Tên cột (snake_case, khớp DB). */
  name: string;
  /** Nhãn tiếng Việt hiển thị. */
  label: string;
  type: FieldType;
  /** Bắt buộc nhập. */
  required?: boolean;
  /** Placeholder cho input. */
  placeholder?: string;
  /** Gợi ý dưới field. */
  hint?: string;
  /** Cho type 'select': danh sách lựa chọn. */
  options?: SelectOption[];
  /** Cho type 'relation': cấu hình combobox auto-add. */
  relation?: {
    /** Tên entity số nhiều cho API: /api/<entity>. VD 'suppliers'. */
    entity: string;
    /** Nhãn loại entity cho text "Tạo <nhãn>". VD 'nhà cung cấp'. */
    entityLabel: string;
  };
  /** Hiện trong bảng list không (mặc định true). */
  inTable?: boolean;
  /** Hiện trong form không (mặc định true). */
  inForm?: boolean;
  /** Cho phép sort theo cột này trong table. */
  sortable?: boolean;
  /** Giá trị mặc định khi tạo mới. */
  defaultValue?: unknown;
  /** Field readonly (hiện nhưng không sửa — VD code auto-gen). */
  readOnly?: boolean;
}

export interface EntitySchema {
  /** Tên entity số nhiều: 'customers', 'products'... */
  name: string;
  /** Nhãn số ít: 'khách hàng', 'sản phẩm'... */
  label: string;
  /** Tên bảng DB. */
  table: string;
  fields: FieldSchema[];
}

/** Sinh Zod schema từ danh sách field — dùng cho react-hook-form resolver. */
export function buildZodSchema(fields: FieldSchema[]): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const f of fields) {
    if (f.inForm === false || f.readOnly) continue;

    let schema: z.ZodTypeAny;

    switch (f.type) {
      case 'number':
      case 'currency': {
        let n = z.coerce.number({ invalid_type_error: `${f.label} phải là số` });
        if (f.required) n = n.min(0, `${f.label} không hợp lệ`);
        schema = f.required ? n : n.optional().or(z.literal(0));
        break;
      }
      case 'switch':
        schema = z.coerce.boolean().default(Boolean(f.defaultValue ?? false));
        break;
      case 'email': {
        const e = z.string().email(`${f.label} không hợp lệ`);
        schema = f.required ? e : e.optional().or(z.literal(''));
        break;
      }
      case 'select':
      case 'relation': {
        const s = z.string();
        schema = f.required
          ? s.min(1, `Vui lòng chọn ${f.label.toLowerCase()}`)
          : s.optional().or(z.literal('')).nullable();
        break;
      }
      case 'date': {
        const d = z.string();
        schema = f.required ? d.min(1, `Vui lòng chọn ${f.label}`) : d.optional().or(z.literal(''));
        break;
      }
      default: {
        // text, textarea, phone
        const t = z.string();
        schema = f.required
          ? t.min(1, `Vui lòng nhập ${f.label.toLowerCase()}`)
          : t.optional().or(z.literal(''));
      }
    }

    shape[f.name] = schema;
  }

  return z.object(shape);
}

/** Giá trị mặc định cho form từ schema. */
export function defaultValuesFromSchema(
  fields: FieldSchema[],
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.inForm === false) continue;
    if (f.defaultValue !== undefined) {
      values[f.name] = f.defaultValue;
    } else if (f.type === 'switch') {
      values[f.name] = false;
    } else if (f.type === 'number' || f.type === 'currency') {
      values[f.name] = 0;
    } else {
      values[f.name] = '';
    }
  }
  return values;
}
