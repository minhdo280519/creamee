'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronDown, ChevronRight } from 'lucide-react';
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
import { SchemaForm } from '@/components/schema-form';
import type { EntityOption } from '@/components/entity-combobox';
import { vnd } from '@/lib/utils';
import { ProductHistoryDialog } from './product-history-dialog';
import { VariantList } from './variant-list';

type ProductWithVariants = Product & {
  variants_count: number;
  first_variant_image: string | null;
};

interface Props {
  products: ProductWithVariants[];
  suppliers: EntityOption[];
  canEdit: boolean;
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
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

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

      {/* Custom table thay DataTable để hỗ trợ expandable rows */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 text-left">Ảnh</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Tên sản phẩm</th>
              <th className="px-3 py-2 text-left">Danh mục</th>
              <th className="px-3 py-2 text-right">Giá sỉ</th>
              <th className="px-3 py-2 text-center">Variants</th>
              <th className="px-3 py-2 text-center">Kho</th>
              {canViewCost && <th className="px-3 py-2 text-right">Giá vốn</th>}
              <th className="px-3 py-2 text-center">Lịch sử</th>
              {canEdit && <th className="px-3 py-2 text-center">Sửa</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                  {query ? 'Không tìm thấy sản phẩm.' : 'Chưa có sản phẩm nào.'}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const isExpanded = expandedId === p.id;
              const thumb = (p.first_variant_image ?? p.image_url) as string | null;
              const stock = Number(p.current_stock ?? 0);
              const reorder = Number(p.reorder_point ?? 0);
              const stockBadge =
                stock === 0
                  ? <Badge variant="destructive" className="text-[10px]">Hết</Badge>
                  : stock <= reorder
                    ? <Badge variant="warning" className="text-[10px]">Sắp hết</Badge>
                    : <Badge variant="success" className="text-[10px]">{stock}</Badge>;

              return (
                <React.Fragment key={p.id}>
                  <tr className={`border-b hover:bg-muted/20 ${isExpanded ? 'bg-muted/10' : ''}`}>
                    {/* Expand toggle */}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => toggleExpand(p.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-9 w-9 rounded border object-cover" />
                      ) : (
                        <div className="h-9 w-9 rounded border bg-muted" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.category ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{vnd(p.wholesale_price_vnd ?? p.base_price_vnd)}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge
                        variant={p.variants_count > 0 ? 'secondary' : 'outline'}
                        className="text-xs cursor-pointer"
                        onClick={() => toggleExpand(p.id)}
                      >
                        {p.variants_count} variant{p.variants_count !== 1 ? 's' : ''}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center">{stockBadge}</td>
                    {canViewCost && (
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {vnd(Number(p.cost_vnd ?? 0))}
                      </td>
                    )}
                    <td className="px-3 py-2 text-center">
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={(e) => { e.stopPropagation(); setHistoryProductId(p.id); }}
                      >
                        Xem
                      </button>
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2 text-center">
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => openEdit(p)}
                        >
                          Sửa
                        </button>
                      </td>
                    )}
                  </tr>

                  {/* Expandable variant panel */}
                  {isExpanded && (
                    <tr className="bg-muted/5">
                      <td colSpan={canEdit ? (canViewCost ? 11 : 10) : (canViewCost ? 10 : 9)}
                        className="px-6 py-3 border-b">
                        <VariantList
                          productId={p.id}
                          productName={p.name}
                          canEdit={canEdit}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

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
