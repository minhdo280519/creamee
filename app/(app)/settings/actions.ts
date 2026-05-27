'use server';

import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { encrypt, maskKey } from '@/lib/crypto';
import type { Role } from '@/lib/roles';
import type { ActionResult } from '@/app/(app)/customers/actions';

async function requireOwner() {
  const profile = await requireUser();
  if ((profile.role as Role) !== 'owner') {
    throw new Error('Chỉ Chủ doanh nghiệp được truy cập cài đặt này');
  }
  return profile;
}

/**
 * Lưu API key của 1 LLM provider — mã hoá trước khi vào DB.
 */
export async function saveLLMKey(
  provider: 'claude' | 'openai' | 'gemini',
  apiKey: string,
): Promise<ActionResult> {
  await requireOwner();

  const trimmed = apiKey.trim();
  if (!trimmed) return { ok: false, error: 'API key trống' };

  let encrypted: string;
  try {
    encrypted = encrypt(trimmed);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Mã hoá thất bại',
    };
  }

  const name = `llm_${provider}`;
  const config = JSON.stringify({
    api_key_encrypted: encrypted,
    key_preview: maskKey(trimmed),
  });

  await query(
    `INSERT INTO integrations (id, name, type, config, is_active)
     VALUES (UUID(), ?, 'llm', ?, 1)
     ON DUPLICATE KEY UPDATE config = ?, is_active = 1`,
    [name, config, config],
  );

  revalidatePath('/settings');
  return { ok: true };
}

/** Xoá API key của 1 provider. */
export async function removeLLMKey(
  provider: 'claude' | 'openai' | 'gemini',
): Promise<ActionResult> {
  await requireOwner();

  await query(
    "UPDATE integrations SET is_active = 0, config = '{}' WHERE name = ?",
    [`llm_${provider}`],
  );

  revalidatePath('/settings');
  return { ok: true };
}

/** Cập nhật một app setting. */
export async function updateAppSetting(
  key: string,
  value: number,
): Promise<ActionResult> {
  await requireOwner();

  await query(
    `INSERT INTO app_settings (id, \`key\`, value)
     VALUES (UUID(), ?, ?)
     ON DUPLICATE KEY UPDATE value = ?`,
    [key, value, value],
  );

  revalidatePath('/settings');
  return { ok: true };
}
