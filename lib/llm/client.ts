/**
 * lib/llm/client.ts — TRỤ CỘT AUTOMATION #4.
 *
 * Wrapper chuẩn cho MỌI lời gọi LLM:
 *   - Logging: request id, provider, model, latency, token, cost
 *   - Error: catch + classify, KHÔNG throw raw
 *   - Retry: exponential backoff + jitter cho 429/5xx, tối đa 3 lần
 *   - Rate limit: token bucket per user + per provider (in-memory)
 *   - Timeout: 60s chat, 10s metadata
 *
 * Mọi nơi gọi LLM PHẢI đi qua callLLM().
 */

import {
  LLMError, type LLMProvider, type Message, type ChatOptions,
  type ChatResponse,
} from './types';

// ── Rate limiter: token bucket in-memory ─────────────────────────────

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

/** Số request tối đa + tốc độ hồi token (request/giây). */
const RATE_CONFIG = {
  perUser: { capacity: 20, refillPerSec: 0.5 },     // 20 burst, hồi 1/2s
  perProvider: { capacity: 100, refillPerSec: 5 },  // 100 burst, hồi 5/s
};

function takeToken(
  key: string,
  config: { capacity: number; refillPerSec: number },
): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: config.capacity, lastRefill: now };
    buckets.set(key, bucket);
  }
  // Hồi token theo thời gian trôi qua.
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    config.capacity,
    bucket.tokens + elapsed * config.refillPerSec,
  );
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

// ── Retry với exponential backoff + jitter ───────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: LLMError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const llmErr =
        err instanceof LLMError
          ? err
          : new LLMError('unknown', String(err));
      lastError = llmErr;

      // Lỗi không retry được hoặc đã hết lượt → ném ra.
      if (!llmErr.retryable || attempt === maxRetries) {
        throw llmErr;
      }

      // Backoff: 2^attempt giây + jitter ngẫu nhiên 0-1s.
      const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  throw lastError ?? new LLMError('unknown', 'Retry thất bại');
}

// ── Timeout wrapper ──────────────────────────────────────────────────

async function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new LLMError('timeout', `Quá thời gian ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

// ── Logging ──────────────────────────────────────────────────────────

interface LogEntry {
  requestId: string;
  userId: string | null;
  provider: string;
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  status: 'success' | 'error';
  errorKind?: string;
}

async function logCall(entry: LogEntry): Promise<void> {
  try {
    console.log('[LLM]', entry.status, entry.provider, entry.model,
      `${entry.latencyMs}ms`, `$${entry.costUsd.toFixed(4)}`);
  } catch {
    // ignore
  }
}

// ── Hàm gọi LLM chính ────────────────────────────────────────────────

export interface CallLLMParams {
  provider: LLMProvider;
  messages: Message[];
  options?: ChatOptions;
  /** id user gọi — cho rate limit + logging. */
  userId?: string;
}

export interface CallLLMResult {
  ok: boolean;
  response?: ChatResponse;
  error?: { kind: string; message: string };
}

/**
 * callLLM — điểm vào DUY NHẤT để gọi LLM.
 * Tự động: rate limit → retry → timeout → log.
 * KHÔNG throw — luôn trả CallLLMResult.
 */
export async function callLLM(params: CallLLMParams): Promise<CallLLMResult> {
  const { provider, messages, options, userId } = params;
  const requestId = crypto.randomUUID();
  const timeoutMs = options?.timeoutMs ?? 60_000;

  // ── Rate limit ─────────────────────────────────────────────────
  if (userId && !takeToken(`user:${userId}`, RATE_CONFIG.perUser)) {
    return {
      ok: false,
      error: { kind: 'rate_limit', message: 'Bạn gọi quá nhanh, thử lại sau ít giây' },
    };
  }
  if (!takeToken(`provider:${provider.name}`, RATE_CONFIG.perProvider)) {
    return {
      ok: false,
      error: { kind: 'rate_limit', message: 'Hệ thống đang quá tải, thử lại sau' },
    };
  }

  const startedAt = Date.now();

  try {
    // ── Retry + timeout ──────────────────────────────────────────
    const response = await withRetry(() =>
      withTimeout(() => provider.chat(messages, options), timeoutMs),
    );

    // ── Log thành công ───────────────────────────────────────────
    await logCall({
      requestId,
      userId: userId ?? null,
      provider: provider.name,
      model: response.model,
      latencyMs: Date.now() - startedAt,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      costUsd: response.costUsd,
      status: 'success',
    });

    return { ok: true, response };
  } catch (err) {
    const llmErr =
      err instanceof LLMError ? err : new LLMError('unknown', String(err));

    // ── Log lỗi ──────────────────────────────────────────────────
    await logCall({
      requestId,
      userId: userId ?? null,
      provider: provider.name,
      model: options?.model ?? 'unknown',
      latencyMs: Date.now() - startedAt,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      status: 'error',
      errorKind: llmErr.kind,
    });

    return {
      ok: false,
      error: { kind: llmErr.kind, message: llmErr.message },
    };
  }
}
