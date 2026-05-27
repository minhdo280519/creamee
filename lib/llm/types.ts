/**
 * lib/llm/types.ts — Abstraction layer chuẩn cho mọi LLM provider.
 * TRỤ CỘT AUTOMATION #3.
 *
 * Mọi provider (OpenAI, Gemini, Claude...) implement cùng interface này
 * → code gọi LLM không phụ thuộc provider cụ thể.
 */

export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ChatOptions {
  /** Model cụ thể; nếu bỏ trống provider dùng model mặc định. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Timeout ms — mặc định 60s cho chat. */
  timeoutMs?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Response đã chuẩn hoá — mọi provider trả về cùng dạng này. */
export interface ChatResponse {
  content: string;
  model: string;
  usage: TokenUsage;
  /** Chi phí ước tính (USD). */
  costUsd: number;
  /** Provider đã xử lý request. */
  provider: string;
  /** Độ trễ ms. */
  latencyMs: number;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  /** Giá USD / 1M token input. */
  inputPricePerM: number;
  /** Giá USD / 1M token output. */
  outputPricePerM: number;
}

/**
 * Interface chuẩn — mọi provider PHẢI implement.
 */
export interface LLMProvider {
  /** Tên provider: 'openai' | 'gemini' | 'claude'... */
  readonly name: string;

  /** Chat đồng bộ (chờ response đầy đủ). */
  chat(messages: Message[], opts?: ChatOptions): Promise<ChatResponse>;

  /** Chat streaming. */
  stream(messages: Message[], opts?: ChatOptions): AsyncIterable<StreamChunk>;

  /** Danh sách model provider hỗ trợ. */
  listModels(): Promise<ModelInfo[]>;
}

/** Phân loại lỗi để xử lý retry/hiển thị. */
export type LLMErrorKind =
  | 'auth'          // API key sai
  | 'rate_limit'    // 429
  | 'timeout'       // quá thời gian
  | 'server_error'  // 5xx
  | 'network'       // mất kết nối
  | 'bad_request'   // 4xx khác
  | 'unknown';

/** Lỗi LLM đã được phân loại — KHÔNG throw lỗi raw. */
export class LLMError extends Error {
  constructor(
    public readonly kind: LLMErrorKind,
    message: string,
    public readonly provider?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'LLMError';
  }

  /** Lỗi này có nên retry không. */
  get retryable(): boolean {
    return (
      this.kind === 'rate_limit' ||
      this.kind === 'timeout' ||
      this.kind === 'server_error' ||
      this.kind === 'network'
    );
  }
}
