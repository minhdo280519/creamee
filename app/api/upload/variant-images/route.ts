import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { requireUser } from '@/lib/auth';

const MAX_FILES = 10;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB mỗi ảnh
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const variantId = formData.get('variantId') as string | null;
  if (!variantId) {
    return NextResponse.json({ error: 'variantId bắt buộc' }, { status: 400 });
  }

  const files = formData.getAll('images') as File[];
  if (!files.length) {
    return NextResponse.json({ error: 'Không có file nào được gửi' }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Tối đa ${MAX_FILES} ảnh` }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'variants', variantId);
  await mkdir(uploadDir, { recursive: true });

  const savedUrls: string[] = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File "${file.name}": chỉ chấp nhận JPEG, PNG, WebP, GIF` },
        { status: 400 },
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File "${file.name}": tối đa 5MB` },
        { status: 400 },
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);
    savedUrls.push(`/uploads/variants/${variantId}/${filename}`);
  }

  return NextResponse.json({ ok: true, urls: savedUrls });
}
