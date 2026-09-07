import release from './data/p13-release.json' with { type: 'json' };
import { requestEnvelope, adaptRevision, parseP13 } from './p13-adapter.ts';
import { validPreference } from './user-preferences.ts';

import {
  parseScene,
  validateScene,
  mergeEdit,
  type Scene,
  type Context,
  type SceneResult,
} from './scene.ts';

export type ModelOption = {
  id: string;
  name: string;
  thinking: string;
  parameters: string[];
};
export const PROMPT_INFO = {
  release: release.release,
  sha256: release.sha256,
  registryVersion: release.registryVersion,
  model: release.model,
  transport: 'deepseek-official',
};
export async function availableModels(
  _fetcher: typeof fetch = fetch,
): Promise<ModelOption[]> {
  return [
    {
      id: release.model,
      name: 'DeepSeek V4 Flash · p13',
      thinking: 'disabled',
      parameters: ['temperature', 'response_format', 'thinking'],
    },
  ];
}
export function systemPrompt() {
  return release.systemPrompt;
}
export type GenerateInput = {
  input: string;
  locale?: 'zh' | 'en';
  context: Context;
  model: string;
  currentScene?: Scene;
  existingScenes?: { id: string; scene: Scene }[];
};
export type Timing = {
  ttft: number | null;
  understandingStart?: number | null;
  understanding: number | null;
  total: number;
  attempts: number;
};
export type GenerationEvent =
  | { type: 'understanding'; text: string }
  | { type: 'retry'; text: string }
  | {
      type: 'result';
      result: SceneResult;
      timing: Timing;
      model: string;
      provenance?: Record<string, unknown>;
    }
  | { type: 'error'; message: string };
export function inputFrom(body: unknown): GenerateInput {
  if (!body || typeof body !== 'object') throw new Error('请求无效');
  const b = body as Record<string, unknown>;
  if (
    typeof b.input !== 'string' ||
    !b.input.trim() ||
    b.input.length > 1200 ||
    typeof b.model !== 'string'
  )
    throw new Error('请输入1–1200字的场景描述');
  const c = b.context as Record<string, unknown>;
  if (b.locale !== undefined && b.locale !== 'zh' && b.locale !== 'en')
    throw new Error('回复语言无效');
  if (
    c?.vehicle !== undefined &&
    (!c.vehicle ||
      typeof c.vehicle !== 'object' ||
      Array.isArray(c.vehicle) ||
      Object.keys(c.vehicle).length > 120 ||
      Object.entries(c.vehicle).some(
        ([k, v]) => k.length > 50 || typeof v !== 'string' || v.length > 100,
      ))
  )
    throw new Error('车况值无效');
  if (
    c?.preferences !== undefined &&
    (!Array.isArray(c.preferences) ||
      c.preferences.length > 24 ||
      !c.preferences.every(validPreference))
  )
    throw new Error('偏好格式无效');
  if (
    !c ||
    typeof c.driving !== 'boolean' ||
    !['none', 'quiet', 'fresh'].includes(String(c.profile)) ||
    (c.ignoredMemories !== undefined &&
      (!Array.isArray(c.ignoredMemories) ||
        c.ignoredMemories.some(
          (m) => typeof m !== 'string' || m.length > 200,
        ) ||
        c.ignoredMemories.length > 8))
  )
    throw new Error('车况或档案无效');
  return {
    input: b.input.trim(),
    locale: b.locale as 'zh' | 'en' | undefined,
    model: b.model,
    context: c as Context,
    currentScene: b.currentScene ? parseScene(b.currentScene) : undefined,
    existingScenes: b.existingScenes === undefined ? [] : (() => {
      if (!Array.isArray(b.existingScenes) || b.existingScenes.length > 60) throw new Error('已有场景列表无效');
      return b.existingScenes.map((s: unknown) => {
        if (!s || typeof s !== 'object' || typeof (s as { id?: unknown }).id !== 'string' || (s as { id: string }).id.length > 80) throw new Error('已有场景引用无效');
        return { id: (s as { id: string }).id, scene: parseScene((s as { scene: unknown }).scene) };
      });
    })(),
  };
}
export function understandingFromPartial(
  text: string,
): { text: string; complete: boolean } | null {
  const match = /"understanding"\s*:\s*"((?:[^"\\]|\\.)*)("|$)/s.exec(text);
  if (!match) return null;
  try {
    return {
      text: JSON.parse('"' + match[1] + '"'),
      complete: match[2] === '"',
    };
  } catch {
    return null;
  }
}
export async function generate(
  input: GenerateInput,
  key: string,
  emit: (event: GenerationEvent) => void,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const started = performance.now();
  const models = await availableModels(fetcher);
  const model = models.find((m) => m.id === input.model);
  if (!model) throw new Error('该模型不在已核对的候选列表中');
  let ttft: number | null = null,
    tUnd: number | null = null,
    tUndStart: number | null = null;
  const baseMessages = [
    { role: 'system', content: systemPrompt() },
    {
      role: 'user',
      content: JSON.stringify(requestEnvelope(input)),
    },
  ];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const body: Record<string, unknown> = {
      // A format retry repeats the same frozen request, including its JSON envelope.
      messages: baseMessages,
      ...release.parameters,
    };
    const r = await fetcher(release.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!r.ok)
      throw new Error(
        r.status === 401
          ? '模型密钥无效，请检查服务端配置'
          : r.status === 402
            ? '模型账户余额不足'
            : r.status === 429
              ? '模型服务繁忙，请稍后重试'
              : `模型服务暂时不可用（${r.status}）`,
      );
    if (!r.body) throw new Error('模型没有返回内容');
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '',
      text = '',
      last = '',
      finished = false;
    function line(value: string) {
      if (!value.startsWith('data:')) return;
      const payload = value.slice(5).trim();
      if (!payload || payload === '[DONE]') {
        if (payload === '[DONE]') finished = true;
        return;
      }
      let event;
      try {
        event = JSON.parse(payload);
      } catch {
        return;
      }
      if (event.error) throw new Error('模型在生成途中中断，请重试');
      for (const choice of event.choices || []) {
        const delta = choice.delta?.content;
        if (typeof delta !== 'string') continue;
        if (ttft === null) ttft = (performance.now() - started) / 1000;
        text += delta;
        if (text.length > 24000) throw new Error('模型输出过长，请重试');
        const und = understandingFromPartial(text);
        if (und) {
          if (und.text && tUndStart === null)
            tUndStart = (performance.now() - started) / 1000;
          if (und.complete && tUnd === null)
            tUnd = (performance.now() - started) / 1000;
          if (und.text !== last) {
            last = und.text;
            emit({ type: 'understanding', text: last });
          }
        }
      }
    }
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const l of lines) line(l.trimEnd());
        if (finished) break;
      }
      buffer += decoder.decode();
      if (buffer.trim()) line(buffer.trimEnd());
    } finally {
      await reader.cancel().catch(() => {});
    }
    let parsed: Scene;
    try {
      parsed = parseP13(JSON.parse(text.trim()));
    } catch {
      if (attempt === 1) {
        tUnd = null;
        tUndStart = null;
        emit({ type: 'retry', text: '格式需要整理，正在重试一次' });
        continue;
      }
      throw new Error('模型输出格式仍不完整，输入已保留，请重试');
    }
    const merged =
      input.currentScene && !input.currentScene.clarify
        ? mergeEdit(
            input.currentScene,
            adaptRevision(input.currentScene, parsed, input.input),
            input.input,
          )
        : { scene: parsed, changed: [] };
    const result = {
      ...validateScene(merged.scene, input.context, input.input),
      changed: merged.changed,
    };
    emit({
      type: 'result',
      result,
      timing: {
        ttft,
        understandingStart: tUndStart,
        understanding: tUnd,
        total: (performance.now() - started) / 1000,
        attempts: attempt,
      },
      model: model.id,
      provenance: {
        ...PROMPT_INFO,
        locale: requestEnvelope(input).locale,
        adapter: input.currentScene ? 'partial-revision-v1' : 'envelope-v1',
        parameters: release.parameters,
      },
    });
    return;
  }
}
