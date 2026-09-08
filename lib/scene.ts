import { validStructuredValue } from './structured-values.ts';
import { CONTRACT, capOf, overflows } from './contract.ts';
import registryData from './data/capabilities.json' with { type: 'json' };
import {
  readPreferences,
  preferenceMemory,
  type UserPreference,
} from './user-preferences.ts';

export type Element = '光' | '声' | '气' | '温' | '话' | '供' | '其他';
export type Entry = { primary: string; secondary: string; op?: string };
export type Memory = {
  type: 'preference' | 'relationship' | 'place' | 'dislike';
  content: string;
  confidence: number;
};
export type Scene = {
  understanding: string;
  relevance: number;
  intent: string;
  name: string;
  logic: 'AND' | 'OR';
  conditions: Entry[];
  actions: Entry[];
  say: string;
  offer: { type: string; target: string };
  memory: Memory[];
  unsupported: string[];
  warnings: string[];
  clarify: string | null;
};
export type Decision = {
  primary: string;
  original: string;
  final?: string;
  status:
    | 'accepted'
    | 'adjusted'
    | 'unsupported'
    | 'forbidden'
    | 'planned'
    | 'proposed';
  reason: string;
  kind: 'action' | 'condition' | 'other';
};
export type SceneResult = {
  scene: Scene;
  decisions: Decision[];
  savable: boolean;
  conceptual: boolean;
  memoryUsed: string[];
  changed: string[];
  runtime?: import('./runtime-client.ts').RuntimeReference;
};
export type ProfileId = 'none' | 'quiet' | 'fresh';
export type Context = {
  driving: boolean;
  profile: ProfileId;
  ignoredMemories?: string[];
  preferences?: UserPreference[];
  vehicle?: Record<string, string>;
};
type Range = { range: (number | string)[] };
type Capability = {
  id: string;
  zh: string;
  group: string;
  class: string;
  status: string;
  maturity: string;
  cond_values: string[] | Range | null;
  act_values: string[] | Range | null;
  deny_act_values: string[];
  notes?: string;
};
export const capabilities = registryData.capabilities as Capability[];
export const registryVersion = registryData.version;
export const PROFILE_LABELS: Record<ProfileId, string> = {
  none: '无记忆档案',
  quiet: '林 · 喜欢安静',
  fresh: '周 · 喜欢清爽',
};
export const profileMemories: Record<ProfileId, Memory[]> = {
  none: [],
  quiet: [
    { type: 'preference', content: '等人或休息时氛围灯亮度20%', confidence: 1 },
    { type: 'preference', content: '等人或休息时媒体音量20%', confidence: 1 },
    { type: 'preference', content: '主驾温度24℃', confidence: 1 },
    { type: 'dislike', content: '不喜欢香氛，不要开香氛', confidence: 1 },
  ],
  fresh: [
    { type: 'preference', content: '等人时氛围灯亮度40%', confidence: 1 },
    { type: 'preference', content: '主驾温度22℃', confidence: 1 },
    { type: 'preference', content: '喜欢自动空气净化', confidence: 1 },
    { type: 'dislike', content: '不喜欢开车窗', confidence: 1 },
  ],
};
export function memoriesFor(ctx: Context): Memory[] {
  return (
    ctx.preferences !== undefined
      ? readPreferences(ctx.preferences)
          .filter((p) => !p.deleted)
          .map(preferenceMemory)
      : profileMemories[ctx.profile] || []
  ).filter((m) => !ctx.ignoredMemories?.includes(m.content));
}
export function waitingActions(ctx: Context): Entry[] {
  const mem = memoriesFor(ctx),
    prefs = readPreferences(ctx.preferences).filter(
      (p) => !p.deleted && !p.negative,
    );
  const preferred = (primary: string, fallback: string, pattern: RegExp) =>
    prefs.find((p) => p.primary === primary)?.value ||
    mem
      .map((m) =>
        m.type === 'preference' ? m.content.match(pattern)?.[1] : undefined,
      )
      .find(Boolean) ||
    fallback;
  const base = [
    {
      primary: '氛围灯亮度',
      secondary: preferred('氛围灯亮度', '30%', /氛围灯亮度(\d+%)/),
    },
    { primary: '音量', secondary: preferred('音量', '20%', /媒体音量(\d+%)/) },
    {
      primary: '主驾温度控制',
      secondary: preferred('主驾温度控制', '24℃', /主驾温度(\d+(?:\.\d+)?℃)/),
    },
  ];
  const extra = [...prefs]
    .reverse()
    .find((p) =>
      [
        '自动空气净化',
        '主驾座椅通风',
        '主驾座椅加热',
        '方向盘加热',
        '声场',
        '内外循环设置',
        '香氛开关',
        '屏幕亮度',
      ].includes(p.primary),
    );
  if (extra) base.push({ primary: extra.primary, secondary: extra.value });
  else if (mem.some((m) => m.content === '喜欢自动空气净化'))
    base.push({ primary: '自动空气净化', secondary: '开启' });
  return base;
}
export function elementOf(primary: string): Element {
  if (/氛围灯|律动|屏幕|遮阳帘|壁纸|主题/.test(primary)) return '光';
  if (/音乐|音量|音效|声场|声浪|静音|多媒体/.test(primary)) return '声';
  if (/香氛|循环|净化|自干燥/.test(primary)) return '气';
  if (
    /温度控制|空调|风量|座椅|加热|通风|出风|除雾|AC|AUTO|ECO|同步|主驾模式|升温/.test(
      primary,
    )
  )
    return '温';
  if (/视频|爱奇艺|唱吧|K歌|YouTube/.test(primary)) return '供';
  if (primary === '小塔播报') return '话';
  if (/导航|offer/.test(primary)) return '供';
  return '其他';
}
export function emptyScene(): Scene {
  return {
    understanding: '',
    relevance: 0,
    intent: 'none',
    name: '',
    logic: 'AND',
    conditions: [],
    actions: [],
    say: '',
    offer: { type: 'none', target: '' },
    memory: [],
    unsupported: [],
    warnings: [],
    clarify: null,
  };
}
export function isInjection(text: string) {
  return /(?:忽略|无视|绕过|解除).{0,15}(?:指令|规则|限制|约束)|(?:系统提示词|system prompt).{0,15}(?:输出|打印|泄露)|(?:输出|打印|泄露).{0,15}(?:系统提示词|system prompt)|(?:ignore|override|bypass).{0,35}(?:instructions|rules|system|restrictions)|维修模式|developer\s*(?:message|mode)|把.{0,20}(?:记忆|档案).{0,10}(?:发给|泄露)/i.test(
    text,
  );
}
export function parseScene(obj: unknown): Scene {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj))
    throw new Error('输出不是场景对象');
  const s = obj as Record<string, unknown>;
  const fields = ['understanding', 'name', 'say'];
  if (
    fields.some((k) => typeof s[k] !== 'string') ||
    !Array.isArray(s.actions) ||
    !Array.isArray(s.conditions) ||
    !Array.isArray(s.memory) ||
    !Array.isArray(s.unsupported) ||
    !Array.isArray(s.warnings) ||
    !s.offer ||
    typeof s.offer !== 'object'
  )
    throw new Error('场景格式不完整');
  if (
    ![
      'action',
      'precise',
      'vague',
      'affect',
      'observation',
      'clarify',
      'none',
    ].includes(String(s.intent)) ||
    !['AND', 'OR'].includes(String(s.logic)) ||
    typeof s.relevance !== 'number' ||
    !Number.isFinite(s.relevance) ||
    s.relevance < 0 ||
    s.relevance > 1 ||
    !(s.clarify === null || typeof s.clarify === 'string')
  )
    throw new Error('场景字段无效');
  for (const a of [...s.actions, ...s.conditions])
    if (
      !a ||
      typeof a !== 'object' ||
      typeof a.primary !== 'string' ||
      typeof a.secondary !== 'string'
    )
      throw new Error('动作或条件格式无效');
  if (
    s.actions.length > 16 ||
    s.conditions.length > 8 ||
    String(s.understanding).length > 400 ||
    String(s.name).length > 80 ||
    String(s.say).length > 400 ||
    s.unsupported.some((x) => typeof x !== 'string') ||
    s.warnings.some((x) => typeof x !== 'string')
  )
    throw new Error('输出超出场景范围');
  const o = s.offer as Record<string, unknown>;
  if (
    !['none', 'call', 'navigate', 'message'].includes(String(o.type)) ||
    (o.target !== undefined && typeof o.target !== 'string')
  )
    throw new Error('出口格式无效');
  return structuredClone({
    ...s,
    offer: { type: o.type, target: o.target || '' },
  }) as Scene;
}
export function normalizeValue(value: string) {
  return value
    .trim()
    .replace(/档/g, '挡')
    .replace(/°C|摄氏度/g, '℃')
    .replace(/\s+/g, '');
}
function isValidValue(value: string, spec: string[] | Range) {
  if (Array.isArray(spec)) return spec.includes(value);
  const [lo, hi, step, unit] = spec.range;
  const matched = value.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!matched || matched[2] !== unit) return false;
  const n = Number(matched[1]);
  return (
    n >= Number(lo) &&
    n <= Number(hi) &&
    Math.abs(
      (n - Number(lo)) / Number(step) -
        Math.round((n - Number(lo)) / Number(step)),
    ) < 1e-7
  );
}
export function validateScene(
  raw: Scene,
  ctx: Context,
  input = '',
): SceneResult {
  const scene = structuredClone(raw),
    decisions: Decision[] = [];
  let invalidCondition = false;
  const mem = memoriesFor(ctx),
    negatives = mem.filter((m) => m.type === 'dislike');
  const cut = (
    a: Entry,
    kind: Decision['kind'],
    status: Decision['status'],
    reason: string,
  ) =>
    decisions.push({
      primary: a.primary,
      original: a.secondary,
      status,
      reason,
      kind,
    });
  if (isInjection(input)) {
    return {
      scene: {
        ...emptyScene(),
        understanding: '这项请求不会改变场景的能力与安全边界。',
        warnings: ['请求包含越权指令，未生成动作'],
      },
      decisions: [
        {
          primary: '请求',
          original: input,
          status: 'forbidden',
          reason: '越权指令已拦截',
          kind: 'other',
        },
      ],
      savable: false,
      conceptual: false,
      memoryUsed: [],
      changed: [],
    };
  }
  function check(items: Entry[], kind: 'action' | 'condition'): Entry[] {
    const result: Entry[] = [],
      seen = new Set<string>();
    for (const original of items) {
      const a = {
        ...original,
        secondary: ['播放指定音乐', '壁纸', '主题'].includes(original.primary)
          ? original.secondary.trim()
          : normalizeValue(original.secondary),
      };
      const cap = capabilities.find((c) => c.zh === a.primary);
      const spec = cap?.[kind === 'action' ? 'act_values' : 'cond_values'];
      if (!cap || !spec) {
        cut(original, kind, 'unsupported', '当前能力表不支持');
        if (kind === 'condition') invalidCondition = true;
        continue;
      }
      if (cap.status !== 'enabled') {
        cut(original, kind, 'unsupported', '能力暂不可用');
        if (kind === 'condition') invalidCondition = true;
        continue;
      }
      if (seen.has(a.primary) && a.primary !== '延时') {
        cut(original, kind, 'unsupported', '同一项重复，保留首次设置');
        if (kind === 'condition') invalidCondition = true;
        continue;
      }
      if (
        kind === 'condition' &&
        (!['==', '<', '<=', '>', '>='].includes(a.op || '') ||
          (Array.isArray(spec) && a.op !== '=='))
      ) {
        cut(original, kind, 'unsupported', '触发条件的比较方式无效');
        invalidCondition = true;
        continue;
      }
      if (kind === 'action' && cap.deny_act_values.includes(a.secondary)) {
        cut(original, kind, 'forbidden', '安全规则不允许关闭行人警报音');
        continue;
      }
      if (
        kind === 'action' &&
        negatives.some(
          (m) =>
            (m.content.includes('香氛') &&
              a.primary.includes('香氛') &&
              a.secondary !== '关闭') ||
            (m.content.includes('车窗') &&
              a.primary.includes('车窗') &&
              a.secondary !== '关闭'),
        )
      ) {
        cut(
          original,
          kind,
          'forbidden',
          '遵循你的偏好：' +
            negatives.find((m) =>
              a.primary.includes(m.content.includes('香氛') ? '香氛' : '车窗'),
            )?.content,
        );
        continue;
      }
      let reason = '';
      if (
        kind === 'action' &&
        /温度控制/.test(a.primary) &&
        /^-?\d+(?:\.\d+)?℃$/.test(a.secondary)
      ) {
        const n = parseFloat(a.secondary);
        if (n < 18 || n > 32) {
          a.secondary = Math.max(18, Math.min(32, n)) + '℃';
          reason = '温度范围为18–32℃';
        }
      }
      if (
        !(
          validStructuredValue(a.primary, a.secondary) ??
          (isValidValue(a.secondary, spec) &&
            ![
              '自定义',
              '自定义动效',
              '地点搜索',
              '收藏地点',
              '常用地点',
              '指定歌曲',
            ].includes(a.secondary))
        )
      ) {
        cut(original, kind, 'unsupported', '取值不在能力表允许范围内');
        if (kind === 'condition') invalidCondition = true;
        continue;
      }
      if (kind === 'action' && ctx.driving) {
        if (
          cap.group === '门' ||
          a.primary === '导航目的地' ||
          a.primary === '进入情景模式' ||
          (cap.group === '娱乐' && a.secondary !== '退出')
        ) {
          cut(original, kind, 'forbidden', '行驶中不操作此项，请停车后修改');
          continue;
        }
        if (cap.group === '车窗' && parseInt(a.secondary) > 20) {
          a.secondary = '20%';
          reason = '行驶中车窗最大开启20%';
        }
        if (a.primary === '氛围灯亮度' && parseInt(a.secondary) > 50) {
          a.secondary = '50%';
          reason = '行驶中氛围灯亮度不超过50%';
        }
        if (a.primary === '音乐律动' && a.secondary !== '关闭') {
          a.secondary = '关闭';
          reason = '行驶中关闭音乐律动';
        }
      }
      const maturity =
        cap.maturity === 'proposed'
          ? 'proposed'
          : ['sprint', 'planned'].includes(cap.maturity)
            ? 'planned'
            : 'accepted';
      decisions.push({
        primary: a.primary,
        original: original.secondary,
        final: a.secondary,
        status: reason ? 'adjusted' : maturity,
        reason:
          reason ||
          (maturity === 'planned'
            ? '规划中，仅概念展示'
            : maturity === 'proposed'
              ? '提议中，需共建，仅概念展示'
              : '能力与取值有效'),
        kind,
      });
      // The model may already have clamped an explicit percentage. Keep the
      // user's original value visible without treating free-form prose as an action.
      if (
        kind === 'action' &&
        ctx.driving &&
        (a.primary === '氛围灯亮度' || cap.group === '车窗')
      ) {
        const limit = a.primary === '氛围灯亮度' ? 50 : 20;
        const match = input.match(
          new RegExp(a.primary + '[^\\d，,。;；\\n]{0,8}(\\d+)%'),
        );
        if (
          match &&
          Number(match[1]) > limit &&
          parseInt(a.secondary) <= limit
        ) {
          const decision = decisions[decisions.length - 1];
          decision.original = match[1] + '%';
          decision.status = 'adjusted';
          decision.reason =
            a.primary === '氛围灯亮度'
              ? '行驶中氛围灯亮度不超过50%'
              : '行驶中车窗最大开启20%';
        }
      }
      // Only a validated delay creates a new phase. An invalid separator must
      // not turn a duplicate into an immediately executable adjustment.
      if (kind === 'action' && a.primary === '延时') seen.clear();
      else seen.add(a.primary);
      result.push(a);
    }
    return result;
  }
  scene.conditions = check(scene.conditions, 'condition');
  scene.actions = check(scene.actions, 'action');
  const unsupportedTrigger =
    /(?:到家|到达|导航).{0,10}(?:前|剩余).{0,6}(?:公里|分钟|距离|时间)|(?:remaining|before arrival).{0,20}(?:distance|kilomet|minutes)/i.test(
      input,
    );
  if (unsupportedTrigger) {
    invalidCondition = true;
    decisions.push({
      primary: '导航剩余距离或时间',
      original: input,
      status: 'unsupported',
      kind: 'condition',
      reason: '当前没有这一触发能力，不能省略条件后保存',
    });
  }
  if (
    /氛围灯.{0,12}(?:蓝色|红色|暖色|冷色|颜色)|(?:blue|red|color).{0,12}(?:ambient|light)/i.test(
      input,
    ) &&
    !decisions.some((d) => /颜色|蓝色|红色/.test(d.primary))
  ) {
    decisions.push({
      primary: '氛围灯颜色',
      original: '',
      status: 'unsupported',
      kind: 'other',
      reason: '当前仅支持亮度与开关，不支持颜色',
    });
  }
  let immatureActions = 0;
  scene.actions = scene.actions.filter((a) => {
    const cap = capabilities.find((c) => c.zh === a.primary);
    if (
      cap &&
      ['planned', 'sprint', 'proposed'].includes(cap.maturity) &&
      ++immatureActions > 1
    ) {
      const index = decisions.findIndex(
        (d) =>
          d.primary === a.primary &&
          d.kind === 'action' &&
          d.final !== undefined,
      );
      if (index >= 0) decisions.splice(index, 1);
      cut(a, 'action', 'unsupported', '同一概念场景最多展示1项未落地动作');
      return false;
    }
    return true;
  });
  if (['vague', 'affect'].includes(scene.intent) && scene.actions.length > 4) {
    for (const a of scene.actions.splice(4)) {
      cut(a, 'action', 'unsupported', '舒适或情绪场景最多4个动作');
      const index = decisions.findIndex(
        (d) => d.primary === a.primary && d.final !== undefined,
      );
      if (index >= 0) decisions.splice(index, 1);
    }
  }
  if (['none', 'clarify'].includes(scene.intent) || scene.clarify) {
    scene.actions = [];
    scene.conditions = [];
    scene.offer = { type: 'none', target: '' };
  }
  if (scene.offer.type !== 'none') {
    decisions.push({
      primary:
        scene.offer.type === 'navigate'
          ? '导航目的地'
          : scene.offer.type === 'call'
            ? '电话'
            : '消息',
      original: scene.offer.target,
      status: 'unsupported',
      kind: 'other',
      reason: '本演示不连接导航、电话或消息服务',
    });
    scene.offer = { type: 'none', target: '' };
  }
  for (const unsupported of scene.unsupported) {
    if (
      /行人.*(?:不可|不能|禁止|关闭)|pedestrian.*(?:off|disable)/i.test(
        unsupported,
      )
    ) {
      if (
        !decisions.some(
          (d) => d.primary === '低速行人警报音' && d.status === 'forbidden',
        )
      )
        decisions.push({
          primary: '低速行人警报音',
          original: '关闭',
          status: 'forbidden',
          kind: 'action',
          reason: '安全规则不允许关闭行人警报音',
        });
      continue;
    }
    if (!decisions.some((d) => d.primary === unsupported))
      decisions.push({
        primary: unsupported,
        original: '',
        status: 'unsupported',
        kind: 'other',
        reason: '当前能力表不支持',
      });
  }
  if (scene.say && overflows(scene.say, CONTRACT.say)) {
    decisions.push({
      primary: '小塔播报',
      original: scene.say,
      kind: 'other',
      status: 'unsupported',
      reason: `话术过长（${[...scene.say].length} > ${capOf(scene.say, CONTRACT.say)} 字符），本次不播报`,
    });
    scene.say = '';
  }
  // 理解句和场景名超限不改写模型的话，只把超限这件事显性记下来，
  // 真正的硬门在 parseAgentOutput：那一层直接判为不合契约并重来一次。
  for (const [field, label] of [
    ['understanding', '理解句'],
    ['name', '场景名'],
  ] as const) {
    const text = scene[field];
    if (text && overflows(text, CONTRACT[field]))
      decisions.push({
        primary: label,
        original: text,
        kind: 'other',
        status: 'unsupported',
        reason: `${label}超长（${[...text].length} > ${capOf(text, CONTRACT[field])} 字符）`,
      });
  }
  scene.memory = scene.memory
    .filter(
      (m) =>
        m &&
        ['preference', 'relationship', 'place', 'dislike'].includes(m.type) &&
        typeof m.content === 'string' &&
        typeof m.confidence === 'number' &&
        m.confidence >= 0.7 &&
        m.confidence <= 1 &&
        /记住|不喜欢|以后|下次|remember|prefer|dislike/i.test(input),
    )
    .slice(0, 3);
  if (invalidCondition) {
    scene.clarify = '有触发条件暂时无法表达，请修改条件后再保存。';
  }
  return {
    scene,
    decisions,
    savable:
      !scene.clarify &&
      !invalidCondition &&
      scene.intent !== 'none' &&
      (scene.actions.length > 0 || !!scene.say),
    conceptual: decisions.some(
      (d) => d.status === 'planned' || d.status === 'proposed',
    ),
    memoryUsed: mem
      .filter((m) =>
        m.type === 'dislike'
          ? decisions.some((d) => d.reason.includes(m.content))
          : scene.actions.some((a) => {
              const relevant =
                m.content.includes(a.primary.replace('控制', '')) ||
                (a.primary === '音量' && m.content.includes('媒体音量')) ||
                (a.primary === '主驾温度控制' &&
                  m.content.includes('主驾温度'));
              return (
                relevant &&
                (a.primary === '自动空气净化'
                  ? a.secondary === '开启'
                  : m.content.includes(a.secondary))
              );
            }),
      )
      .map((m) => m.content),
    changed: [],
  };
}
export function mergeEdit(
  previous: Scene,
  proposed: Scene,
  input: string,
): { scene: Scene; changed: string[] } {
  if (proposed.clarify)
    return { scene: { ...previous, clarify: proposed.clarify }, changed: [] };
  const old = new Map(previous.actions.map((a) => [a.primary, a]));
  const next = new Map(proposed.actions.map((a) => [a.primary, a]));
  const changed = [...new Set([...old.keys(), ...next.keys()])].filter(
    (k) => old.get(k)?.secondary !== next.get(k)?.secondary,
  );
  const conditionChanged =
    JSON.stringify(previous.conditions) !==
      JSON.stringify(proposed.conditions) || previous.logic !== proposed.logic;
  const sayChanged = previous.say !== proposed.say;
  const groups = new Set(changed.map(elementOf));
  if (sayChanged) groups.add('话');
  if (conditionChanged) groups.add('其他');
  const requestedGroups = new Set<Element>();
  if (/灯|亮度|屏幕|dimmer|darker|brighter|light/i.test(input))
    requestedGroups.add('光');
  if (/音量|小声|音乐|播客|声场|volume|quieter|music|podcast/i.test(input))
    requestedGroups.add('声');
  if (/温度|凉|暖|座椅|cooler|warmer|temperature/i.test(input))
    requestedGroups.add('温');
  if (/香氛|净化|空气循环|fragrance|purif/i.test(input))
    requestedGroups.add('气');
  if (
    requestedGroups.size === 1 &&
    [...groups].some((g) => !requestedGroups.has(g))
  ) {
    return {
      scene: {
        ...previous,
        clarify: '这次修改没有准确对应你的要求，请再说具体一点。',
      },
      changed: [],
    };
  }
  const explicitMulti = /全部|整个|重新|所有|all|whole|recreate/i.test(input);
  if (
    !explicitMulti &&
    (groups.size > 1 ||
      (changed.length > 1 &&
        !/替换|改成|换成|改为|replace|instead/i.test(input)))
  )
    return {
      scene: { ...previous, clarify: '这句话涉及多处变化，你想先改哪一项？' },
      changed: [],
    };
  const scene = {
    ...previous,
    actions: proposed.actions,
    conditions: conditionChanged ? proposed.conditions : previous.conditions,
    logic: conditionChanged ? proposed.logic : previous.logic,
    say: sayChanged ? proposed.say : previous.say,
    understanding: proposed.understanding,
    memory: proposed.memory,
    unsupported: proposed.unsupported,
    warnings: proposed.warnings,
    clarify: null,
  };
  if (/名字|命名|叫做|name|rename/i.test(input)) scene.name = proposed.name;
  return {
    scene,
    changed: [
      ...changed,
      ...(conditionChanged ? ['触发条件'] : []),
      ...(sayChanged ? ['小塔播报'] : []),
    ],
  };
}
