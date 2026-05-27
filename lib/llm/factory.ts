/**
 * lib/llm/factory.ts — Factory tạo LLMProvider theo tên.
 *
 *   getProvider('claude') → ClaudeProvider
 *   getProvider('openai') → OpenAIProvider
 *   getProvider('gemini') → GeminiProvider
 *
 * API key lấy từ:
 *   1. Bảng integrations (mã hoá) — ưu tiên
 *   2. Biến môi trường — fallback
 */

import { query } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import type { LLMProvider } from './types';
import { ClaudeProvider } from './providers/claude';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';

export type ProviderName = 'claude' | 'openai' | 'gemini';

/** Lấy API key: ưu tiên DB (mã hoá), fallback env. */
async function resolveApiKey(provider: ProviderName): Promise<string> {
  // Thử lấy từ bảng integrations (MySQL).
  try {
    const { rows } = await query<{ config: string }>(
      'SELECT config FROM integrations WHERE name = ? AND is_active = 1 LIMIT 1',
      [`llm_${provider}`],
    );
    if (rows[0]) {
      const cfg = JSON.parse(rows[0].config) as { api_key_encrypted?: string };
      if (cfg.api_key_encrypted) return decrypt(cfg.api_key_encrypted);
    }
  } catch {
    // Bỏ qua, dùng env.
  }

  // Fallback env.
  const envKey: Record<ProviderName, string | undefined> = {
    claude: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };
  const key = envKey[provider];
  if (!key) {
    throw new Error(`Chưa cấu hình API key cho provider "${provider}"`);
  }
  return key;
}

/** Tạo provider instance. */
export async function getProvider(name: ProviderName): Promise<LLMProvider> {
  const apiKey = await resolveApiKey(name);
  switch (name) {
    case 'claude':
      return new ClaudeProvider(apiKey);
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'gemini':
      return new GeminiProvider(apiKey);
    default:
      throw new Error(`Provider không hỗ trợ: ${name}`);
  }
}

/**
 * getProviderWithFallback — lấy provider chính, nếu lỗi key thì
 * fallback sang Gemini (free tier rộng).
 */
export async function getProviderWithFallback(
  preferred: ProviderName,
): Promise<LLMProvider> {
  try {
    return await getProvider(preferred);
  } catch {
    if (preferred !== 'gemini') {
      return getProvider('gemini');
    }
    throw new Error('Không có LLM provider nào khả dụng');
  }
}
