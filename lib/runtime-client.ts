/** Server-only bridge to the separately versioned Part 1 technical service. */
import {
  parseScene,
  type Scene,
  type SceneResult,
  type Context,
  memoriesFor,
} from './scene.ts';
import {
  readPreferences,
  defaultPreferences,
  preferenceMemory,
} from './user-preferences.ts';
import type { GenerateInput, GenerationEvent } from './generation.ts';

export type RuntimeReference = {
  proposalId: string;
  registryRevision: string;
  valid: boolean;
  executable: boolean;
  trace: unknown[];
  proposedScene: Scene;
};
type RawResult = {
  proposal_id: string;
  registry_revision: string;
  valid: boolean;
  savable: boolean;
  executable: boolean;
  scene: Scene & { relation?: unknown; state_type?: string };
  decisions: {
    status: string;
    code?: string;
    reason: string;
    capability?: string;
  }[];
  provenance: Record<string, unknown> & {
    timing?: {
      ttft: number | null;
      understanding: number | null;
      total: number;
    };
  };
  trace: unknown[];
};

const SCENE_FIELDS = [
  'understanding',
  'relevance',
  'intent',
  'name',
  'logic',
  'conditions',
  'actions',
  'say',
  'offer',
  'memory',
  'unsupported',
  'warnings',
  'clarify',
];
export function toProductResult(raw: RawResult): SceneResult {
  const scene = parseScene(
    Object.fromEntries(
      SCENE_FIELDS.map((k) => [k, raw.scene[k as keyof Scene]]),
    ),
  );
  return {
    scene,
    savable: raw.savable && raw.valid,
    conceptual: raw.decisions.some((d) => d.status === 'planned'),
    changed: [],
    memoryUsed: [],
    decisions: raw.decisions.map((d) => ({
      primary: d.capability || '提案',
      original: '',
      status:
        d.status === 'blocked'
          ? 'forbidden'
          : d.status === 'planned'
            ? 'planned'
            : 'accepted',
      reason: d.reason,
      kind: 'other',
    })),
    runtime: {
      proposalId: raw.proposal_id,
      registryRevision: raw.registry_revision,
      valid: raw.valid,
      executable: raw.executable,
      trace: raw.trace,
      proposedScene: structuredClone(scene),
    },
  };
}

export function runtimeConfigured() {
  return !!(process.env.PART1_RUNTIME_URL && process.env.PART1_RUNTIME_TOKEN);
}

export class Part1Client {
  base: string;
  token: string;
  fetcher: typeof fetch;
  constructor(
    base = process.env.PART1_RUNTIME_URL || '',
    token = process.env.PART1_RUNTIME_TOKEN || '',
    fetcher: typeof fetch = fetch,
  ) {
    const url = new URL(base);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('技术服务地址配置无效');
    if (!token) throw new Error('技术服务未配置认证');
    this.base = url.href.replace(/\/$/, '');
    this.token = token;
    this.fetcher = fetcher;
  }
  async call(
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const response = await this.fetcher(this.base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal || AbortSignal.timeout(12000),
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `技术服务返回 ${response.status}`);
    }
    return response;
  }
  async json(path: string, body?: unknown, signal?: AbortSignal) {
    return (await this.call(path, body, signal)).json();
  }
  async syncContext(
    context: Context,
    existingScenes?: { id: string; scene: Scene }[],
    signal?: AbortSignal,
  ) {
    const preferences = readPreferences(
      context.preferences ?? defaultPreferences(context.profile),
    ).filter((p) => !p.deleted);
    const memories =
      preferences.length || context.preferences !== undefined
        ? preferences.map((p) => ({
            ...preferenceMemory(p),
            ...(p.negative && p.primary !== '备注'
              ? {
                  primary: p.primary,
                  value: p.primary === '香氛开关' ? '开启' : null,
                }
              : {}),
          }))
        : memoriesFor(context);
    return this.json(
      '/demo/context',
      {
        driving: context.driving,
        vehicle: context.vehicle || {},
        memories,
        ...(existingScenes === undefined
          ? {}
          : { saved_scenes: existingScenes }),
      },
      signal,
    );
  }
  async generate(
    input: GenerateInput & {
      observationCandidate?: {
        name: string;
        logic: string;
        conditions: Scene['conditions'];
        actions: Scene['actions'];
        evidence?: unknown;
      };
      existingScenes?: { id: string; scene: Scene }[];
    },
    emit: (e: GenerationEvent) => void,
    signal: AbortSignal,
  ) {
    await this.syncContext(input.context, input.existingScenes, signal);
    const request: Record<string, unknown> = {
      locale:
        input.locale || (/[\u3400-\u9fff]/.test(input.input) ? 'zh' : 'en'),
      utterance: input.input,
      source: 'explicit',
    };
    if (input.observationCandidate) {
      request.source = 'observation';
      request.utterance = '';
      request.observation_candidate = input.observationCandidate;
    }
    if (input.currentScene && !input.currentScene.clarify) {
      const scope = editScope(input.input, input.currentScene);
      if (!scope.length)
        throw new Error('请点明要修改的设备；也可以在卡片中手动编辑。');
      const prior = await this.json(
        '/demo/prepare',
        { scene: input.currentScene },
        signal,
      );
      request.source = 'revision';
      request.current_proposal_id = prior.proposal_id;
      request.edit_scope = scope;
    } else if (input.currentScene?.clarify) {
      request.utterance = `${input.currentScene.understanding}\n${input.currentScene.clarify}\n用户补充：${input.input}`;
    }
    const response = await this.call('/generate', request, signal);
    if (!response.body) throw new Error('技术服务没有返回流');
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let buffer = '',
      completed = false;
    function consume(line: string) {
      if (!line.startsWith('data:')) return;
      const event = JSON.parse(line.slice(5));
      if (event.type === 'understanding')
        emit({ type: 'understanding', text: event.text });
      if (event.type === 'error') throw new Error(event.message);
      if (event.type === 'result') {
        const raw = event.result as RawResult;
        const timing = raw.provenance.timing || {
          ttft: null,
          understanding: null,
          total: 0,
        };
        emit({
          type: 'result',
          result: toProductResult(raw),
          timing: {
            ...timing,
            attempts: raw.provenance.model_called === false ? 0 : 1,
          },
          model: 'DeepSeek V4 Flash · Part 1 Runtime',
          provenance: {
            ...raw.provenance,
            trace: raw.trace,
            relation: raw.scene.relation,
            state_type: raw.scene.state_type,
          },
        });
        completed = true;
      }
    }
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(consume);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consume(buffer);
      if (!completed) throw new Error('技术服务连接中断，提案未完成');
    } finally {
      await reader.cancel().catch(() => {});
    }
  }
}

/**
 * 技术服务（观察入口要用它）跑在另一台机器上，可能会掉线。
 * 掉线时整站不该跟着废：这里做一次带缓存的健康检查，不健康就退回直连生成，
 * 观察入口相应地显示未连接。缓存 15 秒，避免每次生成都多一次往返。
 */
let health: { at: number; ok: boolean } | null = null;

export async function runtimeHealthy(ttlMs = 15000) {
  if (!runtimeConfigured()) return false;
  const now = Date.now();
  if (health && now - health.at < ttlMs) return health.ok;
  let ok = false;
  try {
    // 健康探测给 2.5 秒就够：活着是毫秒级，挂了等 12 秒只是让用户干等。
    await new Part1Client().json('/health', undefined, AbortSignal.timeout(2500));
    ok = true;
  } catch {
    ok = false;
  }
  health = { at: now, ok };
  return ok;
}

export function editScope(text: string, scene: Scene) {
  const aliases: [RegExp, RegExp][] = [
    [/灯|light|glow/i, /灯/],
    [/温度|temperature|cooler|warmer/i, /温度控制/],
    [/音量|volume/i, /^音量$/],
    [/风量|fan|airflow/i, /风量/],
    [/香氛|fragrance/i, /香氛/],
    [/座椅|seat/i, /座椅/],
    [/车窗|window/i, /车窗/],
  ];
  return scene.actions
    .filter(
      (a) =>
        text.includes(a.primary) ||
        aliases.some(
          ([words, name]) => words.test(text) && name.test(a.primary),
        ),
    )
    .map((a) => a.primary);
}
