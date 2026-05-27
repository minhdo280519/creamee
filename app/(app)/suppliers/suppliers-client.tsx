'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Supplier } from '@/lib/types';
import { supplierSchema } from '@/lib/schemas/supplier-schema';
import { createSupplier, updateSupplier } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table';
import { SchemaForm } from '@/components/schema-form';

interface Props {
  suppliers: Supplier[];
  canEdit: boolean;
}

export function SuppliersClient({ suppliers, canEdit }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Supplier | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.contact_person ?? '').toLowerCase().includes(q),
    );
  }, [suppliers, query]);

  async function handleSubmit(values: Record<string, unknown>) {
    const result = editing
      ? await updateSupplier(editing.id, values)
      : await createSupplier(values);
    if (!result.ok) {
      toast.error(result.error ?? 'Lưu thất bại');
      return;
    }
    toast.success(editing ? 'Đã cập nhật NCC' : 'Đã tạo NCC');
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, mã, người liên hệ..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Thêm NCC
          </Button>
        )}
      </div>

      <DataTable
        fields={supplierSchema.fields}
        rows={filtered as unknown as Record<string, unknown>[]}
        onRowClick={
          canEdit
            ? (r) => {
                setEditing(r as unknown as Supplier);
                setDialogOpen(true);
              }
            : undefined
        }
        emptyMessage={query ? 'Không tìm thấy NCC.' : 'Chưa có nhà cung cấp nào.'}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp mới'}
            </DialogTitle>
          </DialogHeader>
          <SchemaForm
            fields={supplierSchema.fields}
            initialValues={editing as unknown as Record<string, unknown> | undefined}
            onSubmit={handleSubmit}
            submitLabel={editing ? 'Cập nhật' : 'Tạo NCC'}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
