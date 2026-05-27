/**
 * lib/llm/providers/gemini.ts — Adapter cho Google Gemini.
 */

import {
  LLMError, type LLMProvider, type Message, type ChatOptions,
  type ChatResponse, type StreamChunk, type ModelInfo,
} from '../types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const MODELS: ModelInfo[] = [
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', inputPricePerM: 1.25, outputPricePerM: 5 },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', inputPricePerM: 0.075, outputPricePerM: 0.3 },
];

const DEFAULT_MODEL = 'gemini-1.5-flash';

function classifyError(status: number, body: string): LLMError {
  if (status === 400 && body.includes('API_KEY')) {
    return new LLMError('auth', 'API key Gemini không hợp lệ', 'gemini', status);
  }
  if (status === 401 || status === 403) {
    return new LLMError('auth', 'API key Gemini không hợp lệ', 'gemini', status);
  }
  if (status === 429) {
    return new LLMError('rate_limit', 'Gemini đang giới hạn tốc độ', 'gemini', status);
  }
  if (status >= 500) {
    return new LLMError('server_error', `Lỗi máy chủ Gemini (${status})`, 'gemini', status);
  }
  return new LLMError('bad_request', `Gemini từ chối: ${body.slice(0, 200)}`, 'gemini', status);
}

/** Chuyển Message[] sang định dạng "contents" của Gemini. */
function toGeminiContents(messages: Message[]) {
  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  return { systemText, contents };
}

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';

  constructor(private readonly apiKey: string) {}

  async chat(messages: Message[], opts?: ChatOptions): Promise<ChatResponse> {
    const model = opts?.model ?? DEFAULT_MODEL;
    const { systemText, contents } = toGeminiContents(messages);
    const startedAt = Date.now();

    let res: Response;
    try {
      res = await fetch(
        `${BASE}/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents,
            ...(systemText
              ? { systemInstruction: { parts: [{ text: systemText }] } }
              : {}),
            generationConfig: {
              temperature: opts?.temperature ?? 1,
              maxOutputTokens: opts?.maxTokens ?? 2048,
            },
          }),
        },
      );
    } catch {
      throw new LLMError('network', 'Không kết nối được tới Gemini', 'gemini');
    }

    if (!res.ok) throw classifyError(res.status, await res.text());

    const data = (await res.json()) as {
      candidates?: { content: { parts: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
    };

    const content =
      data.candidates?.[0]?.content.parts.map((p) => p.text ?? '').join('') ?? '';
    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

    const modelInfo = MODELS.find((m) => m.id === model);
    const costUsd = modelInfo
      ? (inputTokens / 1e6) * modelInfo.inputPricePerM +
        (outputTokens / 1e6) * modelInfo.outputPricePerM
      : 0;

    return {
      content,
      model,
      usage: { inputTokens, outputTokens },
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
    const { systemText, contents } = toGeminiContents(messages);

    let res: Response;
    try {
      res = await fetch(
        `${BASE}/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents,
            ...(systemText
              ? { systemInstruction: { parts: [{ text: systemText }] } }
              : {}),
            generationConfig: { maxOutputTokens: opts?.maxTokens ?? 2048 },
          }),
        },
      );
    } catch {
      throw new LLMError('network', 'Không kết nối được tới Gemini', 'gemini');
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
        if (!payload) continue;
        try {
          const evt = JSON.parse(payload) as {
            candidates?: { content: { parts: { text?: string }[] } }[];
          };
          const delta =
            evt.candidates?.[0]?.content.parts.map((p) => p.text ?? '').join('') ??
            '';
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
