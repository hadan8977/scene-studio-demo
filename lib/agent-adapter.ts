import { memoriesFor, parseScene, type Context, type Scene } from './scene.ts';
import { CONTRACT as LIMIT, capOf } from './contract.ts';

export function parseAgentOutput(value: unknown): Scene {
  const s = parseScene(value);
  const fields = [
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
  if (
    Object.keys(s).some((k) => !fields.includes(k)) ||
    fields.some((k) => !(k in s)) ||
    s.understanding.length > capOf(s.understanding, LIMIT.understanding) ||
    s.name.length > capOf(s.name, LIMIT.name) ||
    s.say.length > capOf(s.say, LIMIT.say) ||
    s.actions.length > LIMIT.actions ||
    s.conditions.length > LIMIT.conditions ||
    s.memory.length > LIMIT.memory
  )
    throw new Error('模型输出不符合冻结契约');
  for (const a of s.actions)
    if (Object.keys(a).some((k) => !['primary', 'secondary'].includes(k)))
      throw new Error('动作结构不符');
  for (const c of s.conditions)
    if (
      !['==', '<', '<=', '>', '>='].includes(c.op || '') ||
      Object.keys(c).some((k) => !['primary', 'op', 'secondary'].includes(k))
    )
      throw new Error('条件结构不符');
  for (const m of s.memory)
    if (
      !m ||
      !['preference', 'relationship', 'place', 'dislike'].includes(m.type) ||
      typeof m.content !== 'string' ||
      typeof m.confidence !== 'number' ||
      Object.keys(m).some(
        (k) => !['type', 'content', 'confidence'].includes(k),
      ) ||
      m.confidence < 0 ||
      m.confidence > 1
    )
      throw new Error('记忆结构不符');
  const rawOffer = (value as Record<string, unknown>).offer as Record<
    string,
    unknown
  >;
  if (
    typeof rawOffer.target !== 'string' ||
    Object.keys(rawOffer).some((k) => !['type', 'target'].includes(k))
  )
    throw new Error('出口结构不符');
  return s;
}

/** Application envelope only. The frozen system prompt is never extended. */
export function requestEnvelope(input: {
  input: string;
  locale?: 'zh' | 'en';
  context: Context;
  currentScene?: Scene;
}) {
  const locale =
    input.locale || (/[\u3400-\u9fff]/.test(input.input) ? 'zh' : 'en');
  const context = [
    // 试过在这里补 [Today] 当前日期，因为 p36 的规则说没有日期就要对
    // 「明天/节日/季节」追问。6 组日期类输入实测 A/B，给与不给的结果完全一样：
    // 告诉它今天是 2026-09-08，它照样追问「明天是哪一天？」。这条规则在 p36
    // 里没有真正读上下文，加了只是多送一行，所以不加。
    `[State] ${input.context.driving ? 'driving, gear D' : 'parked, gear P'}`,
    `[Vehicle] ${JSON.stringify(input.context.vehicle || {})}`,
    `[Memory] ${JSON.stringify(memoriesFor(input.context))}`,
    ...(input.currentScene
      ? [`[Current scene] ${JSON.stringify(input.currentScene)}`]
      : []),
  ].join('\n');
  return {
    locale,
    context,
    utterance:
      input.currentScene && !input.currentScene.clarify
        ? (locale === 'en'
            ? 'Update the current scene. Return only the requested changes: '
            : '修改当前场景，只返回本次涉及的修改项：') + input.input
        : input.currentScene?.clarify
          ? (locale === 'en'
              ? `This answers the question you just asked ("${input.currentScene.clarify}"): `
              : `这是对你刚才那句追问「${input.currentScene.clarify}」的回答：`) +
            input.input
          : input.input,
  };
}

/**
 * 补充追问时，模型偶尔回一张什么都没有的卡（intent=none 且动作、条件、
 * 追问、播报全空）。那不是一次有效回答，界面上就是一张白卡。
 * 这种情况保持原状、把刚才那句问题再问一遍，比给白卡强。
 */
export function adaptCompletion(previous: Scene, proposed: Scene): Scene {
  const empty =
    !proposed.actions.length &&
    !proposed.conditions.length &&
    !proposed.clarify &&
    !proposed.say;
  return empty ? previous : proposed;
}

/** 编辑时模型只回增量。 Merge it into the old scene before the existing edit guard. */
export function adaptRevision(
  previous: Scene,
  delta: Scene,
  input: string,
): Scene {
  if (delta.clarify) return { ...previous, clarify: delta.clarify };
  if (
    delta.intent === 'none' ||
    (!delta.actions.length && !delta.conditions.length && !delta.say)
  )
    return {
      ...previous,
      clarify: /[\u3400-\u9fff]/.test(input)
        ? '你想修改哪一项？'
        : 'Which setting should change?',
    };
  const replacement = new Map(delta.actions.map((a) => [a.primary, a]));
  const actions = previous.actions.map((a) => replacement.get(a.primary) || a);
  for (const a of delta.actions)
    if (!previous.actions.some((p) => p.primary === a.primary)) actions.push(a);
  return {
    ...previous,
    understanding: delta.understanding,
    actions,
    conditions: delta.conditions.length
      ? delta.conditions
      : previous.conditions,
    logic: delta.conditions.length ? delta.logic : previous.logic,
    name: /名字|命名|叫做|name|rename/i.test(input)
      ? delta.name
      : previous.name,
    say: delta.say || previous.say,
    unsupported: delta.unsupported,
    warnings: delta.warnings,
    memory: delta.memory,
    clarify: null,
  };
}
