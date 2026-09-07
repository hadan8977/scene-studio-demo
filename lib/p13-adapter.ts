import { memoriesFor, parseScene, type Context, type Scene } from './scene.ts';

export function parseP13(value: unknown): Scene {
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
    s.understanding.length > 80 ||
    s.name.length > 10 ||
    s.say.length > 15 ||
    s.actions.length > 8 ||
    s.conditions.length > 4 ||
    s.memory.length > 3
  )
    throw new Error('p13 输出结构不符');
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
              ? 'Complete the current scene. Clarification: '
              : '补充当前场景的信息：') + input.input
          : input.input,
  };
}

/** p13 emits a delta for edits. Merge it into the old scene before the existing edit guard. */
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
