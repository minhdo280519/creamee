/**
 * lib/llm/providers/openai.ts — Adapter cho OpenAI.
 */

import {
  LLMError, type LLMProvider, type Message, type ChatOptions,
  type ChatResponse, type StreamChunk, type ModelInfo,
} from '../types';

const API_URL = 'https://api.openai.com/v1/chat/completions';

const MODELS: ModelInfo[] = [
  { id: 'gpt-4o', name: 'GPT-4o', inputPricePerM: 2.5, outputPricePerM: 10 },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', inputPricePerM: 0.15, outputPricePerM: 0.6 },
];

const DEFAULT_MODEL = 'gpt-4o-mini';

function classifyError(status: number, body: string): LLMError {
  if (status === 401 || status === 403) {
    return new LLMError('auth', 'API key OpenAI không hợp lệ', 'openai', status);
  }
  if (status === 429) {
    return new LLMError('rate_limit', 'OpenAI đang giới hạn tốc độ', 'openai', status);
  }
  if (status >= 500) {
    return new LLMError('server_error', `Lỗi máy chủ OpenAI (${status})`, 'openai', status);
  }
  return new LLMError('bad_request', `OpenAI từ chối: ${body.slice(0, 200)}`, 'openai', status);
}

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';

  constructor(private readonly apiKey: string) {}

  async chat(messages: Message[], opts?: ChatOptions): Promise<ChatResponse> {
    const model = opts?.model ?? DEFAULT_MODEL;
    const startedAt = Date.now();

    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: opts?.temperature ?? 1,
          max_tokens: opts?.maxTokens ?? 2048,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
    } catch {
      throw new LLMError('network', 'Không kết nối được tới OpenAI', 'openai');
    }

    if (!res.ok) throw classifyError(res.status, await res.text());

    const data = (await res.json()) as {
      model: string;
      choices: { message: { content: string } }[];
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    const modelInfo = MODELS.find((m) => m.id === model);
    const costUsd = modelInfo
      ? (data.usage.prompt_tokens / 1e6) * modelInfo.inputPricePerM +
        (data.usage.completion_tokens / 1e6) * modelInfo.outputPricePerM
      : 0;

    return {
      content: data.choices[0]?.message.content ?? '',
      model: data.model,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
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

    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: true,
          max_tokens: opts?.maxTokens ?? 2048,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
    } catch {
      throw new LLMError('network', 'Không kết nối được tới OpenAI', 'openai');
    }

    if (!res.ok || !res.body) throw classifyError(res.status, await res.text());

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
            choices: { delta: { content?: string } }[];
          };
          const delta = evt.choices[0]?.delta.content;
          if (delta) yield { delta, done: false };
        } catch {
          // bỏ qua
        }
      }
    }
    yield { delta: '', done: true };
  }

  async listModels(): Promise<ModelInfo[]> {
    return MODELS;
  }
}
