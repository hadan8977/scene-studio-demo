import { DEMO_CASES, type DemoCase } from './demo-cases.ts';
import {
  capabilities,
  emptyScene,
  validateScene,
  type Context,
  type Entry,
  type SceneResult,
  type Scene,
} from './scene.ts';
export type RouteKind =
  | 'scene'
  | 'suggestion'
  | 'control'
  | 'preset'
  | 'chat'
  | 'clarify'
  | 'blocked';
export type IntentRoute = {
  kind: RouteKind;
  input: string;
  reason: string;
  reply: string;
  caseId?: string;
  family?: string;
  question?: string;
  actions?: Entry[];
};
function fromCase(c: DemoCase, input: string): IntentRoute {
  return {
    kind:
      c.entry === 'create'
        ? 'scene'
        : c.entry === 'ambient'
          ? 'suggestion'
          : c.kind || 'chat',
    input,
    reason: c.summary,
    reply: c.reply || '',
    caseId: c.id,
    family: c.family,
    question: c.question,
    actions: c.actions?.map(([primary, secondary]) => ({ primary, secondary })),
  };
}
export function routeInput(input: string, ctx: Context): IntentRoute {
  const q = input.trim();
  const exact = DEMO_CASES.find((c) => c.input === q || c.title === q);
  if (exact) return fromCase(exact, q);
  const base = { input: q, reason: '', reply: '' };
  if (
    /(?:做|建|存|记住|创建|生成|设计|安排).{0,20}场景|场景.{0,20}(?:做|创建)|(?:来|营造|布置|安排).{0,8}氛围|\b(?:create|make|save)\b.*\bscene\b|^(?:每天|每到|工作日|周末|冬天|夏天)/i.test(
      q,
    )
  )
    return { ...base, kind: 'scene', reason: '用户明确要求创建或保存条件组合' };
  if (
    /(关闭|关掉|停用).{0,8}(行人|警报)|(?:turn off|disable).*pedestrian/i.test(
      q,
    )
  )
    return {
      ...base,
      kind: 'blocked',
      reply: '行人警报音不能关闭。',
      reason: '禁止值不会进入车控或场景执行',
    };
  if (
    /(?:打开|开启|进入|退出|关闭).{0,3}(休憩模式|露营模式|洗车模式|后排查看|离车不下电模式|多人同乘隐私模式)/.test(
      q,
    )
  ) {
    const mode = q.match(
      /休憩模式|露营模式|洗车模式|后排查看|离车不下电模式|多人同乘隐私模式/,
    )![0];
    return {
      ...base,
      kind: 'preset',
      reason: '点名官方模式，交给预设，不重新编排',
      actions: [
        {
          primary: /退出|关闭/.test(q) ? '退出情景模式' : '进入情景模式',
          secondary: mode,
        },
      ],
    };
  }
  if (
    /困|想睡|sleepy|drowsy/i.test(q) &&
    (ctx.driving || /开车|驾驶|driv/i.test(q))
  )
    return {
      ...base,
      kind: 'chat',
      reply: '请在安全位置停车休息，别勉强继续开。',
      reason: '行驶中困倦不安排放松或助眠场景',
    };
  if (/热死|好热|太热|很热|冷死|好冷|太冷|很冷|too hot|too cold/i.test(q))
    return {
      ...base,
      kind: 'control',
      reason: '冷热是生理状态，单动作交给车控',
      actions: [
        {
          primary: /冷|cold/i.test(q) ? '极速升温' : 'MAX AC',
          secondary: '开启',
        },
      ],
    };
  const actions: Entry[] = [];
  if (/灯.{0,6}(暗|亮)|(?:dim|brighten).*light/i.test(q))
    actions.push({
      primary: '氛围灯亮度',
      secondary: /暗|dim/i.test(q) ? '20%' : '60%',
    });
  const temp = q.match(/(?:温度|空调|temperature).{0,6}?(\d{2})(?:度|℃|\b)/i);
  if (temp) actions.push({ primary: '主驾温度控制', secondary: temp[1] + '℃' });
  if (/(?:打开|开启|关掉|关闭).{0,3}空调/.test(q))
    actions.push({
      primary: '空调总开关',
      secondary: /关掉|关闭/.test(q) ? '关闭' : '开启',
    });
  if (/(?:打开|开启|关掉|关闭).{0,3}(?:氛围灯|灯光)/.test(q))
    actions.push({
      primary: '氛围灯开关',
      secondary: /关掉|关闭/.test(q) ? '关闭' : '开启',
    });
  if (/(?:打开|开启|关掉|关闭).{0,3}车窗/.test(q))
    actions.push({
      primary: '主驾车窗',
      secondary: /关掉|关闭/.test(q) ? '关闭' : '20%',
    });
  if (actions.length)
    return {
      ...base,
      kind: 'control',
      actions,
      reason: '具体动作已明确，车控直接处理，不创建场景',
    };
  if (/那个|这个|哪一个|turn it on/i.test(q))
    return {
      ...base,
      kind: 'clarify',
      question: '你想打开空调、灯光，还是车窗？',
      reason: '对象不明确，需要先问清楚',
    };
  if (/堵车|又堵|traffic jam/.test(q))
    return {
      ...base,
      kind: 'chat',
      reply: '堵在路上确实烦，慢慢来，注意前方。',
      reason: '车不能用舱内动作改善拥堵，停止主动建议',
    };
  const match = /还要.{0,5}(分钟|一会)|等人|等.{0,5}分钟|minutes.*wait/i.test(q)
    ? 'ambient-wait'
    : /后排.{0,6}睡/.test(q)
      ? 'ambient-rear'
      : /施工|扬尘|灰.{0,5}飘/.test(q)
        ? 'ambient-dust'
        : /晒.{0,7}(下午|座椅)|座椅.{0,3}烫/.test(q)
          ? 'ambient-sun'
          : /开会.{0,5}半小时|离开会/.test(q)
            ? 'ambient-meeting'
            : /长途|路.{0,5}长/.test(q)
              ? 'ambient-long'
              : /累|休息/.test(q) && !ctx.driving
                ? 'ambient-rest'
                : null;
  if (match)
    return fromCase(
      DEMO_CASES.find((c) => c.id === match)!,
      q,
    );
  const emotional = /纪念日|anniversary/i.test(q)
    ? 'ambient-anniversary'
    : /心情.*(?:不好|低落|差)|难受|吵架|难过|sad|feeling down/i.test(q)
      ? 'ambient-emotion'
      : null;
  if (emotional)
    return fromCase(
      DEMO_CASES.find((c) => c.id === emotional)!,
      q,
    );
  return {
    ...base,
    kind: 'chat',
    reply: '我听到了。你可以继续说。',
    reason: '当前演示规则没有足够依据提出场景，不擅自补齐意图',
  };
}
export function controlResult(route: IntentRoute, ctx: Context) {
  return validateScene(
    {
      ...emptyScene(),
      name: '车控',
      intent: 'action',
      actions: route.actions || [],
    },
    ctx,
    route.input,
  );
}
/** A model label alone is not permission to apply a proposed scene. */
export function isImmediateControl(route: IntentRoute, scene: Scene) {
  if (
    route.kind === 'scene' ||
    route.kind === 'suggestion' ||
    scene.conditions.length
  )
    return false;
  if (route.kind === 'control') return true;
  return (
    scene.intent === 'action' &&
    (route.kind === 'chat' ||
      (route.kind === 'clarify' && /\n补充：/.test(route.input))) &&
    !/场景|模式|如果|每当|每天|到.*时|\b(?:scene|when|every|if)\b/i.test(
      route.input,
    ) &&
    /打开|开启|关掉|关闭|调|开到|升高|降低|再凉|再暖|\b(?:set|turn|open|close|lower|raise|dim)\b/i.test(
      route.input,
    ) &&
    /灯|屏幕|温度|空调|音量|座椅|车窗|风量|净化|循环|加热|通风|按摩|\b(?:light|window|temperature|volume|seat|fan|air)\b/i.test(
      route.input,
    )
  );
}
export type AttentionState = {
  quiet: boolean;
  highLoad: boolean;
  questions: number;
  refused: Record<string, number>;
};
export const emptyAttention = (): AttentionState => ({
  quiet: false,
  highLoad: false,
  questions: 0,
  refused: {},
});
export function evaluateSuggestion(
  route: IntentRoute,
  result: SceneResult,
  ctx: Context,
  attention: AttentionState,
  vehicle: Record<string, string>,
  now = Date.now(),
) {
  if (attention.quiet) return '已选择安静，不主动打扰';
  if (attention.highLoad) return '当前驾驶负荷较高，不主动打扰';
  if ((attention.refused[route.family || route.caseId || 'unknown'] || 0) > now)
    return '同类建议处于拒绝后的冷却期';
  if (result.decisions.some((d) => d.reason.startsWith('遵循你的偏好')))
    return '负面偏好优先，本次不建议';
  if (attention.questions >= 1) return '本次演示的询问额度已用完';
  if (!result.savable) return '候选没有通过能力检查，不主动建议';
  if (route.family === 'rest')
    return ctx.driving ? '行驶中不建议休憩模式' : null;
  const changed = result.scene.actions.filter(
    (a) => vehicle[a.primary] !== a.secondary,
  );
  const sections = new Set(
    changed.map((a) => {
      const cap = capabilities.find((c) => c.zh === a.primary);
      return cap?.group === '车窗' || cap?.group === '门'
        ? '门窗'
        : /温度|风量|出风|座椅|升温|空调/.test(a.primary)
          ? '温度与座椅'
          : /净化|循环|香氛/.test(a.primary)
            ? '空气'
            : cap?.group === '声音'
              ? '声音'
              : /灯|屏幕|遮阳|彩蛋/.test(a.primary)
                ? '灯光'
                : '出口';
    }),
  );
  if (changed.length < 2 || sections.size < 2)
    return '当前只有一类设置需要变化，不值得再打包成场景';
  return null;
}
