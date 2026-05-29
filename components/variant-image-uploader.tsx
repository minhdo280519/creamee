'use client';

import * as React from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const MAX_FILES = 10;

interface Props {
  variantId: string;
  existingUrls?: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}

export function VariantImageUploader({
  variantId,
  existingUrls = [],
  onChange,
  disabled,
}: Props) {
  const [urls, setUrls] = React.useState<string[]>(existingUrls);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setUrls(existingUrls);
  }, [existingUrls]);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const remaining = MAX_FILES - urls.length;
    if (remaining <= 0) {
      toast.error(`Tối đa ${MAX_FILES} ảnh mỗi variant`);
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    const formData = new FormData();
    formData.append('variantId', variantId);
    for (const f of selected) formData.append('images', f);

    setUploading(true);
    try {
      const res = await fetch('/api/upload/variant-images', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? 'Upload thất bại');
        return;
      }
      const next = [...urls, ...json.urls as string[]];
      setUrls(next);
      onChange(next);
    } catch {
      toast.error('Lỗi kết nối khi upload ảnh');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeUrl(idx: number) {
    const next = urls.filter((_, i) => i !== idx);
    setUrls(next);
    onChange(next);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-2">
      {/* Preview grid */}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, idx) => (
            <div key={url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Ảnh ${idx + 1}`}
                className="h-20 w-20 rounded-md border object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeUrl(idx)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground hidden group-hover:flex items-center justify-center shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] bg-black/50 text-white rounded-b-md py-0.5">
                {idx + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone — ẩn khi đủ 10 ảnh hoặc disabled */}
      {!disabled && urls.length < MAX_FILES && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/30 p-4 text-muted-foreground hover:border-primary/50 hover:bg-muted/30 transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
          <span className="text-xs">
            {uploading
              ? 'Đang upload...'
              : `Kéo thả hoặc click để thêm ảnh (${urls.length}/${MAX_FILES})`}
          </span>
          <span className="text-[10px]">JPEG, PNG, WebP, GIF — tối đa 5MB/ảnh</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading || disabled}
      />
    </div>
  );
}
