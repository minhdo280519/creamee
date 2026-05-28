'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Product } from '@/lib/types';
import { productSchema } from '@/lib/schemas/product-schema';
import { createProduct, updateProduct, quickCreateSupplier } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table';
import { SchemaForm } from '@/components/schema-form';
import type { EntityOption } from '@/components/entity-combobox';
import { vnd } from '@/lib/utils';
import { ProductHistoryDialog } from './product-history-dialog';

interface Props {
  products: Product[];
  suppliers: EntityOption[];
  canEdit: boolean;
  /** Role có được xem giá vốn không. */
  canViewCost: boolean;
}

export function ProductsClient({
  products, suppliers, canEdit, canViewCost,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [historyProductId, setHistoryProductId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q),
    );
  }, [products, query]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    if (!canEdit) return;
    setEditing(p);
    setDialogOpen(true);
  }

  async function handleSubmit(values: Record<string, unknown>) {
    const result = editing
      ? await updateProduct(editing.id, values)
      : await createProduct(values);

    if (!result.ok) {
      toast.error(result.error ?? 'Lưu thất bại');
      return;
    }
    toast.success(editing ? 'Đã cập nhật sản phẩm' : 'Đã tạo sản phẩm');
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, SKU, danh mục..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Thêm SP
          </Button>
        )}
      </div>

      <DataTable
        fields={productSchema.fields}
        rows={filtered as unknown as Record<string, unknown>[]}
        onRowClick={canEdit ? (r) => openEdit(r as unknown as Product) : undefined}
        emptyMessage={query ? 'Không tìm thấy sản phẩm.' : 'Chưa có sản phẩm nào.'}
        extraColumns={[
          {
            key: 'img',
            label: 'Ảnh',
            render: (r) => {
              const url = r.image_url as string | null;
              if (!url) return <span className="text-muted-foreground text-xs">—</span>;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-9 w-9 rounded object-cover border" />
              );
            },
          },
          {
            key: 'stock_status',
            label: 'Trạng thái kho',
            render: (r) => {
              const stock = Number(r.current_stock ?? 0);
              const reorder = Number(r.reorder_point ?? 0);
              if (stock === 0)
                return <Badge variant="destructive">Hết hàng</Badge>;
              if (stock <= reorder)
                return <Badge variant="warning">Sắp hết</Badge>;
              return <Badge variant="success">Còn hàng</Badge>;
            },
          },
          {
            key: 'history_btn',
            label: 'Lịch sử kho',
            render: (r) => (
              <button
                className="text-xs text-primary hover:underline"
                onClick={(e) => { e.stopPropagation(); setHistoryProductId(r.id as string); }}
              >
                Xem
              </button>
            ),
          },
          // Giá vốn tách đôi — chỉ hiện với role được xem.
          ...(canViewCost
            ? [
                {
                  key: 'goods_cost',
                  label: 'Giá vốn hàng',
                  render: (r: Record<string, unknown>) => (
                    <span>{vnd(Number(r.goods_cost_vnd ?? 0))}</span>
                  ),
                },
                {
                  key: 'ship_cost',
                  label: 'Chi phí ship',
                  render: (r: Record<string, unknown>) => (
                    <span className="text-amber-600">
                      {vnd(Number(r.ship_cost_vnd ?? 0))}
                    </span>
                  ),
                },
                {
                  key: 'landed_cost',
                  label: 'Tổng giá vốn',
                  render: (r: Record<string, unknown>) => (
                    <span className="font-medium">
                      {vnd(Number(r.cost_vnd ?? 0))}
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />

      <ProductHistoryDialog
        productId={historyProductId}
        open={historyProductId !== null}
        onOpenChange={(o) => { if (!o) setHistoryProductId(null); }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
            </DialogTitle>
          </DialogHeader>
          <SchemaForm
            fields={productSchema.fields}
            initialValues={editing as unknown as Record<string, unknown> | undefined}
            onSubmit={handleSubmit}
            submitLabel={editing ? 'Cập nhật' : 'Tạo sản phẩm'}
            onCancel={() => setDialogOpen(false)}
            relationOptions={{ suppliers }}
            relationCreate={{ suppliers: quickCreateSupplier }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
