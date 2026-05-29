'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import type { ProductVariant } from '@/lib/types';
import { getVariantsByProduct } from '@/app/(app)/products/variant-actions';
import { Badge } from '@/components/ui/badge';

interface Props {
  productId: string | null;
  selectedVariantId: string | null;
  onSelect: (variant: ProductVariant | null) => void;
}

export function VariantPicker({ productId, selectedVariantId, onSelect }: Props) {
  const [variants, setVariants] = React.useState<ProductVariant[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!productId) { setVariants([]); onSelect(null); return; }
    let cancelled = false;
    setLoading(true);
    getVariantsByProduct(productId).then((rows) => {
      if (cancelled) return;
      setVariants(rows);
      setLoading(false);
      if (rows.length === 1 && rows[0]) onSelect(rows[0]);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  if (!productId || variants.length === 0) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Đang tải variants...
      </div>
    );
  }

  return (
    <div className="mt-1.5 space-y-1">
      <p className="text-[11px] text-muted-foreground">Chọn màu/size:</p>
      <div className="flex flex-wrap gap-1.5">
        {variants.map((v) => {
          const isSelected = v.id === selectedVariantId;
          const label = [v.color, v.size].filter(Boolean).join(' / ') || v.sku;
          const thumb = v.image_urls?.[0];
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : v)}
              className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition-all ${
                isSelected
                  ? 'border-primary bg-primary/10 font-medium text-primary ring-1 ring-primary'
                  : 'border-border bg-background hover:border-primary/50'
              }`}
            >
              {thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="h-5 w-5 rounded-sm object-cover" />
              )}
              <span>{label}</span>
              {v.current_stock <= 0 && (
                <Badge variant="destructive" className="ml-0.5 text-[9px] px-1 py-0">Hết</Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
