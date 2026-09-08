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
      // 「起个名字」不是车控动作，p36 会判成 intent=none 并回空名字（实测 0/4）。
      // 换成契约内的说法——把手动调好的设置存成场景、设置一项不改——稳定 4/4
      // 拿到贴合语境的名字。只取名字：模型的理解句会复述这段指令本身，
      // 卡片上显示出来是机器味的，保留界面原有那句更好。
      await generate(
        {
          ...input,
          input:
            '我刚把车里手动调成了这样，帮我存成一个场景，名字取得贴合此刻的感觉，设置一项都别改：' +
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
    // 命名失败不该让整次手动创建作废，设置本来就是用户自己选好的。
    if (!result || !result.scene.name.trim())
      return Response.json(
        {
          name: '',
          note: 'AI 这次没给出名称，设置已保留，可自己命名后保存。',
          timing: completed?.timing,
        },
        { status: 200 },
      );
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
