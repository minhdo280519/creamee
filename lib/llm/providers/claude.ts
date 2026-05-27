/**
 * lib/llm/providers/claude.ts — Adapter cho Anthropic Claude.
 * Implement interface LLMProvider — normalize response về schema chung.
 */

import {
  LLMError, type LLMProvider, type Message, type ChatOptions,
  type ChatResponse, type StreamChunk, type ModelInfo,
} from '../types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', inputPricePerM: 15, outputPricePerM: 75 },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', inputPricePerM: 3, outputPricePerM: 15 },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', inputPricePerM: 0.8, outputPricePerM: 4 },
];

const DEFAULT_MODEL = 'claude-sonnet-4-6';

/** Phân loại lỗi HTTP → LLMErrorKind. */
function classifyError(status: number, body: string): LLMError {
  if (status === 401 || status === 403) {
    return new LLMError('auth', 'API key Claude không hợp lệ', 'claude', status);
  }
  if (status === 429) {
    return new LLMError('rate_limit', 'Claude đang giới hạn tốc độ', 'claude', status);
  }
  if (status >= 500) {
    return new LLMError('server_error', `Lỗi máy chủ Claude (${status})`, 'claude', status);
  }
  return new LLMError('bad_request', `Claude từ chối yêu cầu: ${body.slice(0, 200)}`, 'claude', status);
}

export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude';

  constructor(private readonly apiKey: string) {}

  /** Tách system message ra khỏi messages (Claude API yêu cầu riêng). */
  private splitSystem(messages: Message[]): {
    system: string;
    rest: Message[];
  } {
    const systemMsgs = messages.filter((m) => m.role === 'system');
    const rest = messages.filter((m) => m.role !== 'system');
    return { system: systemMsgs.map((m) => m.content).join('\n\n'), rest };
  }

  async chat(messages: Message[], opts?: ChatOptions): Promise<ChatResponse> {
    const model = opts?.model ?? DEFAULT_MODEL;
    const { system, rest } = this.splitSystem(messages);
    const startedAt = Date.now();

    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: opts?.maxTokens ?? 2048,
          temperature: opts?.temperature ?? 1,
          ...(system ? { system } : {}),
          messages: rest.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
    } catch {
      throw new LLMError('network', 'Không kết nối được tới Claude', 'claude');
    }

    if (!res.ok) {
      throw classifyError(res.status, await res.text());
    }

    const data = (await res.json()) as {
      content: { type: string; text?: string }[];
      model: string;
      usage: { input_tokens: number; output_tokens: number };
    };

    const content = data.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n');

    const modelInfo = MODELS.find((m) => m.id === model);
    const costUsd = modelInfo
      ? (data.usage.input_tokens / 1e6) * modelInfo.inputPricePerM +
        (data.usage.output_tokens / 1e6) * modelInfo.outputPricePerM
      : 0;

    return {
      content,
      model: data.model,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
      costUsd,
      provider: this.name,
      latencyMs: Date.now() - startedAt,
    };
  }

  async *stream(
    messages: Message[],
    opts?: ChatOptions,
  ): AsyncIterable<StreamChunk> {
    const model = opts?.model ?? DEFAULT_MODEL;
    const { system, rest } = this.splitSystem(messages);

    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: opts?.maxTokens ?? 2048,
          stream: true,
          ...(system ? { system } : {}),
          messages: rest.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
    } catch {
      throw new LLMError('network', 'Không kết nối được tới Claude', 'claude');
    }

    if (!res.ok || !res.body) {
      throw classifyError(res.status, await res.text());
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload) as {
            type: string;
            delta?: { text?: string };
          };
          if (evt.type === 'content_block_delta' && evt.delta?.text) {
            yield { delta: evt.delta.text, done: false };
          }
        } catch {
          // bỏ qua dòng parse lỗi
        }
      }
    }
    yield { delta: '', done: true };
  }

  async listModels(): Promise<ModelInfo[]> {
    return MODELS;
  }
}
