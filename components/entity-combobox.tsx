'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';

export interface EntityOption {
  id: string;
  label: string;
}

interface EntityComboboxProps {
  /** Danh sách entity hiện có. */
  options: EntityOption[];
  /** id đang được chọn. */
  value: string | null;
  /** Gọi khi chọn 1 entity. */
  onChange: (id: string | null) => void;
  /**
   * Hàm tạo entity mới. Nhận tên người dùng gõ, trả về entity vừa tạo.
   * Đây là điểm gọi POST /api/<entity> { name }.
   */
  onCreate: (name: string) => Promise<EntityOption>;
  placeholder?: string;
  /** Nhãn loại entity, dùng cho text "Tạo <nhãn>". VD: "khách hàng". */
  entityLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * EntityCombobox — TRỤ CỘT AUTOMATION #1.
 *
 * Hành vi:
 *  - User gõ tên CHƯA tồn tại → hiện dòng `+ Tạo "<tên>"` ở cuối list.
 *  - Click dòng đó → gọi onCreate → entity mới được thêm + select NGAY,
 *    KHÔNG mở modal, KHÔNG redirect.
 *  - Optimistic: thêm vào list local trước; nếu API fail thì rollback + toast.
 */
export function EntityCombobox({
  options,
  value,
  onChange,
  onCreate,
  placeholder = 'Chọn...',
  entityLabel = 'mục',
  disabled = false,
  className,
}: EntityComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  // Entity mới tạo trong phiên — gộp với options từ props.
  const [localExtra, setLocalExtra] = React.useState<EntityOption[]>([]);

  const allOptions = React.useMemo(() => {
    const seen = new Set(options.map((o) => o.id));
    return [...options, ...localExtra.filter((o) => !seen.has(o.id))];
  }, [options, localExtra]);

  const selected = allOptions.find((o) => o.id === value) ?? null;

  const trimmed = query.trim();
  const exactExists = allOptions.some(
    (o) => o.label.toLowerCase() === trimmed.toLowerCase(),
  );
  const showCreate = trimmed.length > 0 && !exactExists;

  async function handleCreate() {
    if (!trimmed || creating) return;
    setCreating(true);

    // Optimistic: tạo entity tạm với id giả.
    const tempId = `temp-${Date.now()}`;
    const optimistic: EntityOption = { id: tempId, label: trimmed };
    setLocalExtra((prev) => [...prev, optimistic]);
    onChange(tempId);
    setOpen(false);

    try {
      const created = await onCreate(trimmed);
      // Thay entity tạm bằng entity thật từ server.
      setLocalExtra((prev) =>
        prev.map((o) => (o.id === tempId ? created : o)),
      );
      onChange(created.id);
      setQuery('');
      toast.success(`Đã tạo ${entityLabel}: ${created.label}`);
    } catch (err) {
      // Rollback.
      setLocalExtra((prev) => prev.filter((o) => o.id !== tempId));
      onChange(null);
      toast.error(
        `Không tạo được ${entityLabel}` +
          (err instanceof Error ? `: ${err.message}` : ''),
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn(!selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
          {creating ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter>
          <CommandInput
            placeholder={`Tìm hoặc gõ tên ${entityLabel} mới...`}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!showCreate && <CommandEmpty>Không tìm thấy.</CommandEmpty>}
            <CommandGroup>
              {allOptions.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.label}
                  onSelect={() => {
                    onChange(opt.id === value ? null : opt.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === opt.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreate && (
              <CommandGroup>
                <CommandItem
                  value={`__create__${trimmed}`}
                  onSelect={handleCreate}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Tạo {entityLabel} &quot;{trimmed}&quot;
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
