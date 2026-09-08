import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  systemPrompt,
  PROMPT_INFO,
  generate,
  type GenerationEvent,
} from '../lib/generation.ts';
import {
  requestEnvelope,
  adaptRevision,
  parseAgentOutput,
} from '../lib/agent-adapter.ts';
import {
  emptyScene,
  mergeEdit,
  capabilities,
  validateScene,
} from '../lib/scene.ts';
import { isImmediateControl, routeInput } from '../lib/intent-routing.ts';
import { exampleScene } from '../lib/examples.ts';
import { vehicleShortcut } from '../lib/vehicle-shortcuts.ts';
const ctx = { driving: false, profile: 'none' as const };
void test('runtime prompt is the unmodified p36 frozen release, including examples', () => {
  const file = readFileSync(
    new URL('../lib/prompts/p36-system-zh.md', import.meta.url),
    'utf8',
  ).replace(/\r\n/g, '\n');
  assert.equal(systemPrompt(), file);
  assert.equal(
    createHash('sha256').update(file).digest('hex'),
    'cffcda9a8f58920e3cbcfc9d532373d204d865bb2098c75163b6d23a6707b6aa',
  );
  assert.equal(PROMPT_INFO.model, 'deepseek-v4-flash');
});
void test('envelope uses locale and actual supplied vehicle values; unknown temperature is not fabricated', () => {
  const zh = requestEnvelope({
    input: '再凉一点',
    context: { ...ctx, vehicle: { 主驾温度控制: '27℃' } },
  });
  assert.equal(zh.locale, 'zh');
  assert.match(zh.context, /27℃/);
  assert.equal(
    requestEnvelope({ input: 'Make it cooler', context: ctx }).locale,
    'en',
  );
  assert.doesNotMatch(
    requestEnvelope({ input: 'Make it cooler', context: ctx }).context,
    /24℃/,
  );
});
void test('partial p13 edits retain unrelated actions and are still checked by the local edit guard', () => {
  const prev = exampleScene('wait', ctx),
    delta = {
      ...emptyScene(),
      name: '灯光',
      intent: 'action',
      actions: [{ primary: '氛围灯亮度', secondary: '20%' }],
    };
  const result = mergeEdit(
    prev,
    adaptRevision(prev, delta, '灯再暗一点'),
    '灯再暗一点',
  );
  assert.equal(
    result.scene.actions.find((a) => a.primary === '主驾温度控制')?.secondary,
    '24℃',
  );
  assert.deepEqual(result.changed, ['氛围灯亮度']);
  const wrong = {
    ...delta,
    actions: [{ primary: '主驾温度控制', secondary: '20℃' }],
  };
  assert.ok(
    mergeEdit(prev, adaptRevision(prev, wrong, '灯再暗一点'), '灯再暗一点')
      .scene.clarify,
  );
});
void test('p13 structure rejects extra fields and overlong replies before capability validation', () => {
  assert.throws(() => parseAgentOutput({ ...emptyScene(), extra: 'unexpected' }));
  assert.throws(() => parseAgentOutput({ ...emptyScene(), say: 'x'.repeat(61) }));
  assert.throws(() =>
    parseAgentOutput({
      ...emptyScene(),
      offer: { type: 'none', target: '', execute: true },
    }),
  );
  assert.ok(parseAgentOutput(emptyScene()));
});

void test('an action label cannot apply an explicit or weak scene request without confirmation', () => {
  const s = {
    ...emptyScene(),
    intent: 'action',
    actions: [{ primary: '音量', secondary: '20%' }],
  };
  assert.equal(
    isImmediateControl(routeInput('创建一个安静的场景', ctx), s),
    false,
  );
  assert.equal(
    isImmediateControl(routeInput('她说还要二十分钟', ctx), s),
    false,
  );
  assert.equal(isImmediateControl(routeInput('把音量调到20%', ctx), s), true);
  assert.equal(isImmediateControl(routeInput('现在很安静', ctx), s), false);
  assert.equal(isImmediateControl(routeInput('累了，打开按摩', ctx), s), true);
  assert.equal(
    isImmediateControl(routeInput('打开那个\n补充：灯光', ctx), s),
    true,
  );
  assert.equal(
    isImmediateControl(routeInput('把音量调到20%', ctx), {
      ...s,
      conditions: [{ primary: '时间', op: '==', secondary: '18:00' }],
    }),
    false,
  );
});

void test('model-side safety rejection and clamping retain correct audit labels and requested values', () => {
  const rejected = validateScene(
    {
      ...emptyScene(),
      intent: 'clarify',
      unsupported: ['低速行人警报音不可关闭'],
      clarify: '保留灯光吗？',
    },
    ctx,
    '关闭行人警报音',
  );
  assert.equal(rejected.decisions[0].status, 'forbidden');
  assert.equal(rejected.savable, false);
  const result = validateScene(
    {
      ...emptyScene(),
      intent: 'vague',
      name: '夜驾',
      actions: [
        { primary: '氛围灯亮度', secondary: '50%' },
        { primary: '主驾车窗', secondary: '20%' },
      ],
    },
    { ...ctx, driving: true },
    '主驾车窗开到100%，氛围灯亮度100%',
  );
  assert.equal(
    result.decisions.every(
      (d) => d.status === 'adjusted' && d.original === '100%',
    ),
    true,
  );
  assert.deepEqual(
    result.decisions.map((d) => d.final),
    ['50%', '20%'],
  );
});
void test('vehicle modes have their own host route and never become invented scene capabilities', () => {
  assert.equal(
    vehicleShortcut('进入露营模式', false)?.reply,
    '已进入露营模式。',
  );
  assert.equal(
    vehicleShortcut('进入录音模式', false)?.reply,
    '已进入录音模式。',
  );
  assert.equal(vehicleShortcut('进入露营模式', true)?.applied, false);
  assert.equal(vehicleShortcut('做一个露营场景', false), null);
  // 能力表按删除线口径拉平后，未上线能力与已上线能力同等，不再标成熟度
  assert.equal(
    capabilities.find((c) => c.zh === '进入情景模式')?.maturity,
    'released',
  );
  assert.equal(
    capabilities.find((c) => c.zh === '录音模式'),
    undefined,
  );
});
void test('direct AI test reaches the official DeepSeek endpoint with exact p36 configuration and traceable result', async () => {
  const events: GenerationEvent[] = [],
    scene = {
      ...emptyScene(),
      intent: 'action',
      name: '暖座',
      actions: [{ primary: '主驾座椅加热', secondary: '1挡' }],
    };
  let called = 0;
  await generate(
    { input: '打开主驾座椅加热', context: ctx, model: 'deepseek-v4-flash' },
    'fixture-key',
    (e) => events.push(e),
    new AbortController().signal,
    (async (url, opts) => {
      called++;
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      assert.equal(JSON.parse(opts!.body as string).model, 'deepseek-v4-flash');
      assert.equal(typeof opts?.body, 'string');
      const body = JSON.parse(opts!.body as string);
      assert.equal(body.max_tokens, 1000);
      assert.equal(body.temperature, 0);
      assert.deepEqual(body.thinking, { type: 'disabled' });
      assert.deepEqual(body.response_format, { type: 'json_object' });
      assert.equal(body.messages[0].content, systemPrompt());
      assert.deepEqual(Object.keys(JSON.parse(body.messages[1].content)), [
        'locale',
        'context',
        'utterance',
      ]);
      return new Response(
        'data: ' +
          JSON.stringify({
            choices: [{ delta: { content: JSON.stringify(scene) } }],
          }) +
          '\n\ndata: [DONE]\n\n',
      );
    }) as typeof fetch,
  );
  assert.equal(called, 1);
  const result = events.find((e) => e.type === 'result');
  assert.ok(result && result.type === 'result');
  assert.equal(result.result.scene.intent, 'action');
  assert.equal(result.provenance?.sha256, PROMPT_INFO.sha256);
});
