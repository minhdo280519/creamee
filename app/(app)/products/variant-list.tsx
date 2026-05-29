'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Images } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductVariant } from '@/lib/types';
import { deleteVariant, getVariantsByProduct } from './variant-actions';
import { VariantFormDialog } from './variant-form-dialog';
import { VariantImageGallery } from './variant-image-gallery';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { vnd } from '@/lib/utils';

interface Props {
  productId: string;
  productName: string;
  canEdit: boolean;
}

export function VariantList({ productId, productName, canEdit }: Props) {
  const router = useRouter();
  const [variants, setVariants] = React.useState<ProductVariant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProductVariant | null>(null);
  const [galleryVariant, setGalleryVariant] = React.useState<ProductVariant | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getVariantsByProduct(productId).then((rows) => {
      if (!cancelled) { setVariants(rows); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [productId]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(v: ProductVariant) {
    setEditing(v);
    setFormOpen(true);
  }

  async function handleDelete(v: ProductVariant) {
    if (!confirm(`Xóa variant "${v.sku}"?`)) return;
    const r = await deleteVariant(v.id);
    if (!r.ok) { toast.error(r.error ?? 'Xóa thất bại'); return; }
    setVariants((prev) => prev.filter((x) => x.id !== v.id));
    toast.success('Đã xóa variant');
    router.refresh();
  }

  function handleFormClose(open: boolean) {
    setFormOpen(open);
    if (!open) {
      // Reload variants sau khi lưu
      getVariantsByProduct(productId).then(setVariants);
    }
  }

  if (loading) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Đang tải variants...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {variants.length} variant — {productName}
        </span>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Thêm variant
          </Button>
        )}
      </div>

      {variants.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Chưa có variant nào. Nhấn "Thêm variant" để bắt đầu.
        </p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left">Ảnh</th>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-left">Màu</th>
                <th className="px-3 py-2 text-left">Size</th>
                <th className="px-3 py-2 text-right">Giá vốn (VND)</th>
                <th className="px-3 py-2 text-right">Giá bán sỉ</th>
                <th className="px-3 py-2 text-right">Tồn kho</th>
                <th className="px-3 py-2 text-center">Ảnh</th>
                {canEdit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const thumb = v.image_urls?.[0];
                const imgCount = v.image_urls?.length ?? 0;
                const stockBadge =
                  v.current_stock === 0
                    ? <Badge variant="destructive" className="text-[10px]">Hết</Badge>
                    : v.current_stock < 10
                      ? <Badge variant="warning" className="text-[10px]">Sắp hết</Badge>
                      : <Badge variant="success" className="text-[10px]">{v.current_stock}</Badge>;

                return (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-10 w-10 rounded border object-cover cursor-pointer"
                          onClick={() => setGalleryVariant(v)}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center">
                          <Images className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{v.sku}</td>
                    <td className="px-3 py-2">
                      {v.color ? (
                        <Badge variant="outline" className="text-xs">{v.color}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {v.size ? (
                        <Badge variant="secondary" className="text-xs">{v.size}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{vnd(v.cost_vnd)}</td>
                    <td className="px-3 py-2 text-right font-medium">{vnd(v.price_vnd)}</td>
                    <td className="px-3 py-2 text-right">{stockBadge}</td>
                    <td className="px-3 py-2 text-center">
                      {imgCount > 0 ? (
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => setGalleryVariant(v)}
                        >
                          {imgCount} ảnh
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEdit(v)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(v)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <VariantFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        productId={productId}
        editing={editing}
      />

      {galleryVariant && (
        <VariantImageGallery
          variant={galleryVariant}
          open={!!galleryVariant}
          onOpenChange={(o) => { if (!o) setGalleryVariant(null); }}
        />
      )}
    </div>
  );
}
