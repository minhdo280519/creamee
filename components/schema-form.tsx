'use client';

import * as React from 'react';
import { useForm, Controller, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildZodSchema, defaultValuesFromSchema, type FieldSchema,
} from '@/lib/schema-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EntityCombobox, type EntityOption } from '@/components/entity-combobox';

interface SchemaFormProps {
  fields: FieldSchema[];
  /** Giá trị ban đầu (cho chế độ sửa). */
  initialValues?: Record<string, unknown>;
  /** Lưu form — nhận object dữ liệu, trả Promise. */
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  /** Hàm nạp option cho field relation. key = entity name. */
  relationOptions?: Record<string, EntityOption[]>;
  /** Hàm tạo entity mới cho field relation. key = entity name. */
  relationCreate?: Record<string, (name: string) => Promise<EntityOption>>;
  submitLabel?: string;
  onCancel?: () => void;
}

/**
 * SchemaForm — render form ĐỘNG từ FieldSchema[].
 * Mỗi field type → control tương ứng:
 *   text/phone/email → Input | textarea → Textarea | number/currency → Input number
 *   select → Select | switch → Switch | date → Input date
 *   relation → EntityCombobox (auto-add)
 */
export function SchemaForm({
  fields,
  initialValues,
  onSubmit,
  relationOptions = {},
  relationCreate = {},
  submitLabel = 'Lưu',
  onCancel,
}: SchemaFormProps) {
  const formFields = fields.filter((f) => f.inForm !== false);
  const zodSchema = React.useMemo(() => buildZodSchema(fields), [fields]);

  const {
    control, register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<FieldValues>({
    resolver: zodResolver(zodSchema),
    defaultValues: { ...defaultValuesFromSchema(fields), ...initialValues },
  });

  async function submit(values: FieldValues) {
    try {
      await onSubmit(values as Record<string, unknown>);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {formFields.map((f) => {
          const err = errors[f.name]?.message as string | undefined;
          const fullWidth = f.type === 'textarea';

          return (
            <div
              key={f.name}
              className={`space-y-1.5 ${fullWidth ? 'sm:col-span-2' : ''}`}
            >
              <Label htmlFor={f.name}>
                {f.label}
                {f.required && <span className="ml-0.5 text-destructive">*</span>}
              </Label>

              {/* text / phone / email */}
              {(f.type === 'text' || f.type === 'phone' || f.type === 'email') && (
                <Input
                  id={f.name}
                  type={f.type === 'email' ? 'email' : 'text'}
                  placeholder={f.placeholder}
                  readOnly={f.readOnly}
                  {...register(f.name)}
                />
              )}

              {/* textarea */}
              {f.type === 'textarea' && (
                <Textarea id={f.name} placeholder={f.placeholder} {...register(f.name)} />
              )}

              {/* number / currency */}
              {(f.type === 'number' || f.type === 'currency') && (
                <Input
                  id={f.name}
                  type="number"
                  step={f.type === 'currency' ? '1000' : 'any'}
                  placeholder={f.placeholder}
                  readOnly={f.readOnly}
                  {...register(f.name)}
                />
              )}

              {/* date */}
              {f.type === 'date' && (
                <Input id={f.name} type="date" {...register(f.name)} />
              )}

              {/* switch */}
              {f.type === 'switch' && (
                <Controller
                  control={control}
                  name={f.name}
                  render={({ field }) => (
                    <div className="flex h-10 items-center">
                      <Switch
                        checked={Boolean(field.value)}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )}
                />
              )}

              {/* select */}
              {f.type === 'select' && (
                <Controller
                  control={control}
                  name={f.name}
                  render={({ field }) => (
                    <Select
                      value={(field.value as string) || ''}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id={f.name}>
                        <SelectValue placeholder={f.placeholder ?? 'Chọn...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {(f.options ?? []).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}

              {/* relation — combobox auto-add */}
              {f.type === 'relation' && f.relation && (
                <Controller
                  control={control}
                  name={f.name}
                  render={({ field }) => (
                    <EntityCombobox
                      options={relationOptions[f.relation!.entity] ?? []}
                      value={(field.value as string) || null}
                      onChange={field.onChange}
                      entityLabel={f.relation!.entityLabel}
                      placeholder={f.placeholder}
                      onCreate={
                        relationCreate[f.relation!.entity] ??
                        (async (name) => ({ id: name, label: name }))
                      }
                    />
                  )}
                />
              )}

              {f.hint && !err && (
                <p className="text-xs text-muted-foreground">{f.hint}</p>
              )}
              {err && <p className="text-xs text-destructive">{err}</p>}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Huỷ
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
