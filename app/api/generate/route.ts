export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { generate, inputFrom, generationConfigured } from '@/lib/generation';
import { isInjection, emptyScene, validateScene } from '@/lib/scene';
import { Part1Client, runtimeHealthy, editScope } from '@/lib/runtime-client';
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
  const key = process.env.DEEPSEEK_OFFICIAL_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!generationConfigured() && !(await runtimeHealthy()))
    return Response.json(
      {
        error:
          '真实 AI 尚未连接，请在服务端配置 DEEPSEEK_API_KEY。示例模式仍可使用。',
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
        // 技术服务只允许改场景里已有的动作。新增一项、只改名字这类修改它
        // 表达不了，与其让它拒收再兜，不如先按结构判断直接走直连。
        const revising = !!body.currentScene && !body.currentScene.clarify;
        const outOfScope =
          revising && !editScope(body.input, body.currentScene!).length;
        if ((await runtimeHealthy()) && !(outOfScope && key))
          try {
            await new Part1Client().generate(body, emit, lifecycle.signal);
          } catch (error) {
            // 技术服务只允许改场景里已有的动作。新增一项、只改名字这类修改
            // 它表达不了，会整条拒收；这种时候退回直连生成，而不是让用户
            // 看到一句英文报错。其它错误照常抛出。
            const text = error instanceof Error ? error.message : '';
            const scopeIssue =
              /scope|Choose existing actions|explicit action/i.test(text);
            if (!scopeIssue || !key || lifecycle.signal.aborted) throw error;
            emit({ type: 'retry', text: '这次修改换个方式处理' });
            await generate(body, key, emit, lifecycle.signal);
          }
        else if (isInjection(body.input))
          emit({
            type: 'result',
            result: validateScene(emptyScene(), body.context, body.input),
            timing: { ttft: null, understanding: null, total: 0, attempts: 0 },
            model: '本地验证器',
          });
        else if (key) await generate(body, key, emit, lifecycle.signal);
        else throw new Error('生成服务未配置');
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
