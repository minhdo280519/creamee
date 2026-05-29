'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ProductVariant } from '@/lib/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Props {
  variant: ProductVariant;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function VariantImageGallery({ variant, open, onOpenChange }: Props) {
  const urls = variant.image_urls ?? [];
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => { setCurrent(0); }, [variant.id]);

  function prev() { setCurrent((c) => (c === 0 ? urls.length - 1 : c - 1)); }
  function next() { setCurrent((c) => (c === urls.length - 1 ? 0 : c + 1)); }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  }

  const label = [variant.sku, variant.color, variant.size].filter(Boolean).join(' · ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl"
        onKeyDown={handleKey}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            {label}
            <Badge variant="secondary" className="text-xs">
              {urls.length} ảnh
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {urls.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
            Chưa có ảnh nào
          </div>
        ) : (
          <div className="space-y-3">
            {/* Main image */}
            <div className="relative flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden"
              style={{ minHeight: 360 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[current]}
                alt={`Ảnh ${current + 1}`}
                className="max-h-[60vh] max-w-full object-contain rounded"
              />
              {urls.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={next}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
              <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
                {current + 1} / {urls.length}
              </span>
            </div>

            {/* Thumbnails */}
            {urls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {urls.map((url, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt={`Thumbnail ${idx + 1}`}
                    onClick={() => setCurrent(idx)}
                    className={`h-14 w-14 flex-shrink-0 cursor-pointer rounded border-2 object-cover transition-all ${
                      idx === current
                        ? 'border-primary shadow-md scale-105'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
