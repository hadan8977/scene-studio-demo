export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { generate, inputFrom, nonSceneRoute } from '@/lib/generation';
import { isInjection, emptyScene, validateScene } from '@/lib/scene';
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: '请求来源无效' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 40000)
    return Response.json({ error: '请求过大' }, { status: 413 });
  let body;
  try {
    const text = await request.text();
    if (text.length > 40000) throw new Error('请求过大');
    body = inputFrom(JSON.parse(text));
  } catch {
    return Response.json(
      { error: '请求格式无效，请检查输入与场景' },
      { status: 400 },
    );
  }
  const routed = nonSceneRoute(body);
  if (routed)
    return Response.json(
      { error: routed.reason, route: routed.kind, executed: false },
      { status: 422 },
    );
  const key = process.env.OPENROUTER_API_KEY;
  if (!key)
    return Response.json(
      {
        error:
          '真实 AI 尚未连接，请在服务端配置 OPENROUTER_API_KEY。示例模式仍可使用。',
      },
      { status: 503 },
    );
  const lifecycle = new AbortController();
  const timer = setTimeout(() => lifecycle.abort(), 30000);
  request.signal.addEventListener('abort', () => lifecycle.abort(), {
    once: true,
  });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: unknown) => {
        if (!lifecycle.signal.aborted)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
      };
      try {
        if (isInjection(body.input))
          emit({
            type: 'result',
            result: validateScene(emptyScene(), body.context, body.input),
            timing: { ttft: null, understanding: null, total: 0, attempts: 0 },
            model: '本地验证器',
          });
        else await generate(body, key, emit, lifecycle.signal);
      } catch (error) {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: lifecycle.signal.aborted ? '等待超过30秒，输入已保留，请重试' : error instanceof Error ? error.message : '生成失败，请重试' })}\n\n`,
            ),
          );
        } catch {}
      } finally {
        clearTimeout(timer);
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      clearTimeout(timer);
      lifecycle.abort();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
