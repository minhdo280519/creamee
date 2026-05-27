'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Customer } from '@/lib/types';
import { customerSchema } from '@/lib/schemas/customer-schema';
import { createCustomer, updateCustomer } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table';
import { SchemaForm } from '@/components/schema-form';

const TIER_VARIANT: Record<string, 'default' | 'secondary' | 'warning' | 'success'> = {
  vip: 'warning',
  gold: 'warning',
  silver: 'secondary',
  standard: 'default',
};

interface Props {
  customers: Customer[];
  canEdit: boolean;
}

export function CustomersClient({ customers, canEdit }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Customer | null>(null);

  // Lọc client-side theo tên / SĐT / mã.
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [customers, query]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(c: Customer) {
    if (!canEdit) return;
    setEditing(c);
    setDialogOpen(true);
  }

  async function handleSubmit(values: Record<string, unknown>) {
    const result = editing
      ? await updateCustomer(editing.id, values)
      : await createCustomer(values);

    if (!result.ok) {
      toast.error(result.error ?? 'Lưu thất bại');
      return;
    }
    toast.success(editing ? 'Đã cập nhật khách hàng' : 'Đã tạo khách hàng');
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, SĐT, mã KH..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Thêm KH
          </Button>
        )}
      </div>

      <DataTable
        fields={customerSchema.fields}
        rows={filtered as unknown as Record<string, unknown>[]}
        onRowClick={canEdit ? (r) => openEdit(r as unknown as Customer) : undefined}
        emptyMessage={query ? 'Không tìm thấy khách hàng phù hợp.' : 'Chưa có khách hàng nào.'}
        extraColumns={[
          {
            key: 'tier_badge',
            label: 'Hạng',
            render: (r) => {
              const tier = String(r.tier ?? 'standard');
              return (
                <Badge variant={TIER_VARIANT[tier] ?? 'default'}>
                  {customerSchema.fields
                    .find((f) => f.name === 'tier')
                    ?.options?.find((o) => o.value === tier)?.label ?? tier}
                </Badge>
              );
            },
          },
        ]}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Sửa khách hàng' : 'Thêm khách hàng mới'}
            </DialogTitle>
          </DialogHeader>
          <SchemaForm
            fields={customerSchema.fields}
            initialValues={editing as unknown as Record<string, unknown> | undefined}
            onSubmit={handleSubmit}
            submitLabel={editing ? 'Cập nhật' : 'Tạo khách hàng'}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
