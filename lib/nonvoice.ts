import {
  capabilities,
  emptyScene,
  memoriesFor,
  validateScene,
  type Context,
  type Entry,
  type Scene,
  type SceneResult,
  sameEntries,
} from './scene.ts';

export type Evidence = {
  occurrences: number;
  opportunities: number;
  ageDays: number;
  validationDays: number;
  overlap: number;
  validated: boolean;
};
export type SceneOrigin = {
  entry: 'observation' | 'capture' | 'voice';
  storyId?: string;
  automatic: boolean;
  lastTriggeredAt?: string;
  lastUsedAt?: string;
  evidence?: Evidence;
};
export type Story = {
  id: string;
  title: string;
  name: string;
  entry: SceneOrigin['entry'];
  category: string;
  body: string;
  invitation: string;
  tab: string;
  actions: Entry[];
  conditions: Entry[];
  context: Record<string, string>;
  basic?: boolean;
  evidence?: Evidence;
};
export const action = (primary: string, secondary: string): Entry => ({
  primary,
  secondary,
});
const condition = (primary: string, secondary: string): Entry => ({
  primary,
  secondary,
  op: '==',
});
const evidence: Evidence = {
  occurrences: 4,
  opportunities: 5,
  ageDays: 9,
  validationDays: 3,
  overlap: 0.85,
  validated: true,
};
export const STORIES: Story[] = [
  {
    id: 'half-song',
    title: '到家后的半首歌',
    name: '半首歌',
    entry: 'observation',
    category: '留一点自己的时间',
    body: '车已经停好，音乐还在放。你没有急着下车，像往常一样，把屏幕和灯光收暗了一些。',
    invitation: '再坐一会儿？',
    tab: '声音',
    actions: [
      action('屏幕模式', '黑夜模式'),
      action('屏幕亮度', '20%'),
      action('氛围灯亮度', '20%'),
      action('声场', '主驾模式'),
    ],
    conditions: [],
    context: { 时段: '夜晚' },
    evidence,
  },
  {
    id: 'after-movement',
    title: '运动后的十分钟',
    name: '缓下来',
    entry: 'observation',
    category: '少伸一次手',
    body: '刚上车时想凉快一点，过几分钟又把风调小。先散热、再柔和，这几步你已经做过几次了。',
    invitation: '先凉快一下，过会儿风小一点？',
    tab: '空调',
    actions: [
      action('前排风量调节', '3挡'),
      action('主驾座椅通风', '2挡'),
      action('延时', '300秒'),
      action('前排风量调节', '2挡'),
      action('主驾座椅通风', '1挡'),
    ],
    conditions: [],
    context: { 时段: '下午' },
    evidence,
  },
  {
    id: 'breeze',
    title: '这阵风，刚刚好',
    name: '透透气',
    entry: 'capture',
    category: '留住喜欢的感觉',
    body: '停在喜欢的地方，开一点窗，让风和音乐都轻一些。没有特别的目的，只是觉得此刻很舒服。',
    invitation: '调到舒服，再把这一刻留下来。',
    tab: '车窗',
    actions: [
      action('主驾车窗', '20%'),
      action('前排风量调节', '1挡'),
      action('音量', '20%'),
    ],
    conditions: [],
    context: { 时段: '傍晚' },
  },
  {
    id: 'workplace',
    title: '后排的临时工作位',
    name: '工作位',
    entry: 'capture',
    category: '商务 · 一起把事情做完',
    body: '到会场还有十分钟。同事在后排核对电脑材料，你关上遮阳帘、让车内安静些，临时腾出一个好用的小空间。',
    invitation: '主驾与后排同事 · 共同使用全车设置',
    tab: '车窗',
    actions: [
      action('电动遮阳帘', '关闭'),
      action('音量', '10%'),
      action('前排风量调节', '1挡'),
      action('主驾温度控制', '23℃'),
    ],
    conditions: [],
    context: { 时段: '上午', 副驾座椅: '无人' },
  },
  {
    id: 'together',
    title: '各自舒服',
    name: '各自舒服',
    entry: 'capture',
    category: '家庭 · 谁也不用迁就',
    body: '主驾想凉快一点，副驾家人却觉得冷。分别调好两侧的温度和座椅，终于不用再来回调空调了。',
    invitation: '主驾偏凉 · 副驾偏暖 · 两个座位分别设置',
    tab: '空调',
    actions: [
      action('温区同步', '关闭'),
      action('主驾温度控制', '22℃'),
      action('副驾温度控制', '25℃'),
      action('主驾座椅通风', '1挡'),
      action('副驾座椅加热', '1挡'),
    ],
    conditions: [],
    context: { 时段: '下午', 副驾座椅: '有人' },
  },
  {
    id: 'morning',
    title: '晨间暖舱',
    name: '晨间暖舱',
    entry: 'observation',
    category: '基础示例 · 下次自动使用',
    body: '工作日清晨出发前，你习惯调好温度，打开一点座椅加热，让灯光柔和下来。',
    invitation: '把这几步记为晨间暖舱？',
    tab: '座椅',
    actions: [
      action('主驾温度控制', '22℃'),
      action('主驾座椅加热', '1挡'),
      action('氛围灯亮度', '20%'),
    ],
    conditions: [
      condition('星期类型', '工作日'),
      condition('时段', '清晨'),
      condition('挡位', '挡位P'),
    ],
    context: { 星期类型: '工作日', 时段: '清晨' },
    evidence,
    basic: true,
  },
  {
    id: 'waiting',
    title: '等人时这样',
    name: '等一会儿',
    entry: 'capture',
    category: '基础示例 · 裁掉临时设置',
    body: '等人的时候调好了温度和灯光，刚才临时开的除雾不用一起留下。长按后，选出真正想保存的几项。',
    invitation: '保存时可以取消临时除雾。',
    tab: '空调',
    actions: [
      action('主驾温度控制', '23℃'),
      action('氛围灯亮度', '20%'),
      action('音量', '20%'),
      action('前风窗除雾', '开启'),
    ],
    conditions: [],
    context: { 时段: '傍晚' },
    basic: true,
  },
];
export const CONTROL_GROUPS: Record<string, string[]> = {
  空调: [
    '主驾温度控制',
    '副驾温度控制',
    '温区同步',
    '前排风量调节',
    '出风模式设置',
    '自动空气净化',
    '前风窗除雾',
  ],
  座椅: ['主驾座椅通风', '主驾座椅加热', '副驾座椅通风', '副驾座椅加热'],
  灯光: ['氛围灯开关', '氛围灯亮度', '音乐律动', '屏幕模式', '屏幕亮度'],
  声音: ['音量', '声场', '音效'],
  车窗: ['主驾车窗', '副驾车窗', '电动遮阳帘'],
};
export const VEHICLE_DEFAULTS: Record<string, string> = {
  主驾温度控制: '24℃',
  副驾温度控制: '24℃',
  温区同步: '开启',
  前排风量调节: '2挡',
  出风模式设置: '吹面',
  自动空气净化: '关闭',
  前风窗除雾: '关闭',
  主驾座椅通风: '关闭',
  主驾座椅加热: '关闭',
  副驾座椅通风: '关闭',
  副驾座椅加热: '关闭',
  氛围灯开关: '开启',
  氛围灯亮度: '50%',
  音乐律动: '关闭',
  屏幕模式: '白天模式',
  屏幕亮度: '70%',
  音量: '30%',
  声场: '全车模式',
  音效: '立体声',
  主驾车窗: '关闭',
  副驾车窗: '关闭',
  电动遮阳帘: '100%',
  挡位: '挡位P',
  时段: '下午',
  星期类型: '工作日',
  主驾座椅: '有人',
  副驾座椅: '无人',
};
export function valuesFor(primary: string, conditional = false): string[] {
  const cap = capabilities.find((c) => c.zh === primary);
  const spec = cap?.[conditional ? 'cond_values' : 'act_values'];
  if (!spec) return [];
  return (
    Array.isArray(spec)
      ? spec
      : Array.from(
          {
            length: Math.min(
              601,
              1 +
                (Number(spec.range[1]) - Number(spec.range[0])) /
                  Number(spec.range[2]),
            ),
          },
          (_, i) =>
            `${Number(spec.range[0]) + i * Number(spec.range[2])}${spec.range[3]}`,
        )
  ).filter((v) => !cap?.deny_act_values.includes(v));
}
export type ManualEvent = {
  primary: string;
  value: string;
  at: number;
  profile: string;
};
export function captureChoices(
  events: ManualEvent[],
  vehicle: Record<string, string>,
  profile: string,
  now: number,
) {
  const latest = new Map<string, ManualEvent>();
  for (const e of events) if (e.profile === profile) latest.set(e.primary, e);
  return [...latest.values()]
    .filter(
      (e) =>
        e.at <= now &&
        vehicle[e.primary] === e.value &&
        e.value !== VEHICLE_DEFAULTS[e.primary] &&
        valuesFor(e.primary).includes(e.value),
    )
    .sort((a, b) => b.at - a.at)
    .map((e) => ({ ...e, recent: now - e.at <= 600000 }));
}
export function sceneFrom(story: Story): Scene {
  return {
    ...emptyScene(),
    name: story.name,
    intent: story.entry === 'observation' ? 'observation' : 'action',
    relevance: 0.9,
    understanding: story.invitation,
    actions: structuredClone(story.actions),
    conditions: structuredClone(story.conditions),
  };
}
export type LearningState = {
  enabled: boolean;
  paused: boolean;
  refused: Record<string, number>;
  ignored: Record<string, number>;
  deleted: string[];
  lastOffered: number;
  offers: Record<string, number>;
};
export const freshLearning = (): LearningState => ({
  enabled: true,
  paused: false,
  refused: {},
  ignored: {},
  deleted: [],
  lastOffered: 0,
  offers: {},
});
export function validEvidence(value: unknown): value is Evidence {
  if (!value || typeof value !== 'object') return false;
  const e = value as Evidence;
  return (
    [
      e.occurrences,
      e.opportunities,
      e.ageDays,
      e.validationDays,
      e.overlap,
    ].every((v) => typeof v === 'number' && Number.isFinite(v)) &&
    Number.isInteger(e.occurrences) &&
    Number.isInteger(e.opportunities) &&
    e.occurrences >= 3 &&
    e.opportunities >= e.occurrences &&
    e.occurrences / e.opportunities >= 0.7 &&
    e.ageDays >= 0 &&
    e.ageDays <= 14 &&
    e.validated === true &&
    e.validationDays >= 1 &&
    e.validationDays <= 7 &&
    e.overlap >= 0.7 &&
    e.overlap <= 1
  );
}
export function observationReason(
  story: Story,
  ctx: Context,
  state: LearningState,
  now: number,
  highLoad = false,
  quiet = false,
): string | null {
  const e = story.evidence;
  if (!state.enabled || state.paused) return '本趟不记录或学习已关闭';
  if (quiet || highLoad || ctx.driving) return '当前不适合建议';
  if (state.deleted.includes(story.id)) return '相关记录已删除';
  if ((state.refused[story.id] || 0) > now) return '同类建议处于冷却期';
  if (state.lastOffered && now - state.lastOffered < 2 * 86400000)
    return '观察建议额度已用完';
  if (state.offers[story.id] && now - state.offers[story.id] < 30 * 86400000)
    return '同一候选暂不重复建议';
  if (!validEvidence(e)) return '观察记录尚未通过验证';
  if (
    new Set(
      story.actions.filter((a) => a.primary !== '延时').map((a) => a.primary),
    ).size < 2
  )
    return '单项操作不生成习惯建议';
  const checked = validateScene(sceneFrom(story), ctx);
  if (
    !checked.savable ||
    checked.scene.actions.length !== story.actions.length ||
    checked.decisions.some(
      (d) => d.status === 'forbidden' || d.reason.startsWith('遵循你的偏好'),
    )
  )
    return '当前能力或负面偏好不允许建议';
  const negatives = memoriesFor(ctx).filter((m) => m.type === 'dislike');
  if (
    negatives.some((m) =>
      story.actions.some(
        (a) => m.content.includes(a.primary) && a.secondary !== '关闭',
      ),
    )
  )
    return '已遵循负面偏好';
  return null;
}
export function executable(result: SceneResult) {
  return (
    result.savable &&
    !result.conceptual &&
    !result.decisions.some((d) =>
      ['forbidden', 'unsupported', 'planned', 'proposed'].includes(d.status),
    ) &&
    [...result.scene.conditions, ...result.scene.actions].every((a) =>
      capabilities.some(
        (c) =>
          c.zh === a.primary &&
          c.status === 'enabled' &&
          ['released', 'no_ux'].includes(c.maturity),
      ),
    )
  );
}
export function conditionsMatch(
  scene: Scene,
  vehicle: Record<string, string>,
): boolean {
  if (!scene.conditions.length) return false;
  const matches = scene.conditions.map((c) => {
    const raw = vehicle[c.primary];
    if (raw === undefined) return false;
    if (c.op === '==' || !c.op) return raw === c.secondary;
    const a = parseFloat(raw),
      b = parseFloat(c.secondary);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return c.op === '<'
      ? a < b
      : c.op === '<='
        ? a <= b
        : c.op === '>'
          ? a > b
          : c.op === '>='
            ? a >= b
            : false;
  });
  return scene.logic === 'AND' ? matches.every(Boolean) : matches.some(Boolean);
}
export function stages(actions: Entry[]) {
  let at = 0;
  const groups: { at: number; items: { entry: Entry; index: number }[] }[] = [
    { at, items: [] },
  ];
  actions.forEach((entry, index) => {
    if (entry.primary === '延时') {
      at += parseFloat(entry.secondary);
      groups.push({ at, items: [] });
    } else groups[groups.length - 1].items.push({ entry, index });
  });
  return groups;
}
export const stageLabel = (at: number) =>
  at === 0 ? '开始时' : at % 60 === 0 ? `${at / 60} 分钟后` : `${at} 秒后`;

/** A continuously true condition fires once; a new trip explicitly re-arms it. */
export class TriggerLatch {
  private matches = new Map<string, boolean>();
  reset() {
    this.matches.clear();
  }
  check(
    id: string,
    enabled: boolean,
    scene: Scene,
    vehicle: Record<string, string>,
  ) {
    const hit = enabled && conditionsMatch(scene, vehicle),
      before = this.matches.get(id) || false;
    this.matches.set(id, hit);
    return hit && !before;
  }
}

/** In-memory only: refresh never resumes stale vehicle work. */
export class ScenePlayback {
  scene: Scene;
  before: Record<string, string>;
  values: Record<string, string> = {};
  pending: { at: number; entry: Entry }[] = [];
  overridden = new Set<string>();
  elapsed = 0;
  constructor(scene: Scene, vehicle: Record<string, string>) {
    this.scene = structuredClone(scene);
    this.before = { ...vehicle };
    for (const group of stages(scene.actions))
      for (const { entry } of group.items)
        this.pending.push({ at: group.at, entry });
  }
  advance(seconds: number, vehicle: Record<string, string>, ctx: Context) {
    this.elapsed += seconds;
    const checked = validateScene(this.scene, ctx);
    if (
      !executable(checked) ||
      !sameEntries(checked.scene.actions, this.scene.actions)
    ) {
      this.pending = [];
      throw new Error('车况或能力已变化，后续动作已停止');
    }
    const next = { ...vehicle };
    this.pending = this.pending.filter((job) => {
      if (this.overridden.has(job.entry.primary)) return false;
      if (job.at > this.elapsed) return true;
      next[job.entry.primary] = job.entry.secondary;
      this.values[job.entry.primary] = job.entry.secondary;
      return false;
    });
    return next;
  }
  takeover(primary: string) {
    this.overridden.add(primary);
    this.pending = this.pending.filter((j) => j.entry.primary !== primary);
  }
  undo(vehicle: Record<string, string>) {
    this.pending = [];
    const next = { ...vehicle };
    for (const [p, v] of Object.entries(this.values))
      if (!this.overridden.has(p) && next[p] === v) {
        if (p in this.before) next[p] = this.before[p];
        else delete next[p];
      }
    return next;
  }
}
