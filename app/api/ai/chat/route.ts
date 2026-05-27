/**
 * app/api/ai/chat/route.ts
 * Endpoint chat AI — streaming SSE.
 */

import { type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { getProviderWithFallback, type ProviderName } from '@/lib/llm/factory';
import type { Message } from '@/lib/llm/types';
import { LLMError } from '@/lib/llm/types';

const SYSTEM_PROMPT = `Bạn là trợ lý AI của CREAMEE ERP — hệ thống quản lý
doanh nghiệp bán sỉ quần áo. Trả lời ngắn gọn, bằng tiếng Việt, tập trung
vào nghiệp vụ: đơn hàng, khách hàng, tồn kho, công nợ, báo cáo.`;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: 'Chưa đăng nhập' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body: { messages?: Message[]; provider?: ProviderName };
  try {
    body = (await req.json()) as { messages?: Message[]; provider?: ProviderName };
  } catch {
    return new Response(JSON.stringify({ error: 'Body không hợp lệ' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const messages = body.messages ?? [];
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: 'Thiếu nội dung chat' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const fullMessages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];

  let provider;
  try {
    provider = await getProviderWithFallback(body.provider ?? 'claude');
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Không có LLM khả dụng' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of provider.stream(fullMessages, { maxTokens: 1024 })) {
          if (chunk.delta) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta: chunk.delta })}\n\n`),
            );
          }
          if (chunk.done) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          }
        }
      } catch (err) {
        const msg = err instanceof LLMError ? err.message : 'Lỗi khi gọi AI';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  });
}
