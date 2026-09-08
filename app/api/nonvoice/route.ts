import {
  inputFrom,
  generate,
  generationConfigured,
  type GenerationEvent,
} from '@/lib/generation';
import {
  parseScene,
  validateScene,
  sameEntries,
  sameSettings,
} from '@/lib/scene';
import { Part1Client, runtimeHealthy } from '@/lib/runtime-client';
import { validEvidence } from '@/lib/nonvoice';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: '请求来源无效' }, { status: 403 });
  const abort = new AbortController(),
    timer = setTimeout(() => abort.abort(), 30000);
  request.signal.addEventListener('abort', () => abort.abort(), { once: true });
  try {
    const text = await request.text();
    if (text.length > 40000) throw Error('请求过大');
    const body = JSON.parse(text);
    if (!['capture', 'observation'].includes(body.kind))
      throw Error('入口无效');
    const input = inputFrom({
      input: '非语音方案命名',
      model: body.model,
      context: body.context,
      existingScenes: body.existingScenes,
    });
    const scene = parseScene(body.scene),
      checked = validateScene(scene, input.context);
    if (
      !checked.savable ||
      checked.decisions.some((d) =>
        ['forbidden', 'unsupported'].includes(d.status),
      ) ||
      !sameEntries(checked.scene.actions, scene.actions)
    )
      throw Error('选定设置未通过能力检查');
    let completed: Extract<GenerationEvent, { type: 'result' }> | undefined;
    const emit = (e: GenerationEvent) => {
      if (e.type === 'error') throw Error(e.message);
      if (e.type === 'result') completed = e;
    };
    if (body.kind === 'observation') {
      if (
        input.context.driving ||
        !validEvidence(body.evidence) ||
        new Set(
          scene.actions
            .filter((a) => a.primary !== '延时')
            .map((a) => a.primary),
        ).size < 2
      )
        throw Error('观察依据未通过检查');
      if (!(await runtimeHealthy()))
        return Response.json(
          { error: '观察入口的 AI 运行时未连接；当前设置已保留，可直接保存。' },
          { status: 503 },
        );
      await new Part1Client().generate(
        {
          ...input,
          input: '',
          locale: 'zh',
          observationCandidate: {
            name: scene.name,
            logic: scene.logic,
            conditions: scene.conditions,
            actions: scene.actions,
            evidence: body.evidence,
          },
        },
        emit,
        abort.signal,
      );
      const result = completed?.result;
      if (!result?.savable || !sameSettings(result.scene, scene))
        throw Error('AI 改动了已确定的设置，已拒绝该结果');
    } else {
      // 各供应商在 generation 里各读各的环境变量，这里只是兜底的那一个。
      const key =
        process.env.DEEPSEEK_OFFICIAL_API_KEY ||
        process.env.DEEPSEEK_API_KEY ||
        '';
      if (!generationConfigured())
        return Response.json(
          { error: 'AI 命名未连接，仍可使用当前名称保存。' },
          { status: 503 },
        );
      await generate(
        {
          ...input,
          input:
            '为这组已经选好的车内设置起一个简短中文名称：' +
            JSON.stringify({
              actions: scene.actions,
              conditions: scene.conditions,
            }),
        },
        key,
        emit,
        abort.signal,
      );
    }
    const result = completed?.result;
    if (!result?.scene.name.trim()) throw Error('未收到有效名称');
    return Response.json({
      name: result.scene.name.slice(0, 20),
      understanding:
        body.kind === 'observation' ? result.scene.understanding : undefined,
      runtime: body.kind === 'observation' ? result.runtime : undefined,
      timing: completed?.timing,
    });
  } catch (e) {
    return Response.json(
      {
        error: abort.signal.aborted
          ? '等待超过30秒，设置已保留'
          : e instanceof Error
            ? e.message
            : '命名失败',
      },
      { status: 400 },
    );
  } finally {
    clearTimeout(timer);
  }
}
