import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STORIES,
  CONTROL_GROUPS,
  VEHICLE_DEFAULTS,
  sceneFrom,
  executable,
  captureChoices,
  freshLearning,
  observationReason,
  stages,
  ScenePlayback,
  TriggerLatch,
  valuesFor,
} from '../lib/nonvoice.ts';
import { validateScene, type Context } from '../lib/scene.ts';
const ctx: Context = { driving: false, profile: 'none' };
const story = (id: string) => STORIES.find((s) => s.id === id)!;

void test('seven independent stories use only released capabilities and valid values', () => {
  assert.equal(STORIES.length, 7);
  assert.equal(STORIES.filter((s) => !s.basic).length, 5);
  for (const s of STORIES) {
    const r = validateScene(sceneFrom(s), ctx);
    assert.ok(executable(r), s.id + ': ' + JSON.stringify(r.decisions));
    assert.deepEqual(r.scene.actions, s.actions);
  }
  for (const p of Object.values(CONTROL_GROUPS).flat())
    assert.ok(valuesFor(p).includes(VEHICLE_DEFAULTS[p]), p + ' default');
  assert.equal(
    story('workplace').actions.some((a) => a.primary.includes('后排温度')),
    false,
  );
  assert.ok(
    story('together').actions.some(
      (a) => a.primary === '温区同步' && a.secondary === '关闭',
    ),
  );
});
void test('capture selects final nondefault values for the current profile, with older values optional', () => {
  const now = 1000000,
    vehicle = {
      ...VEHICLE_DEFAULTS,
      音量: '20%',
      主驾温度控制: '22℃',
      主驾座椅加热: '1挡',
    };
  const events = [
    { primary: '音量', value: '10%', at: now - 100, profile: 'none' },
    { primary: '音量', value: '20%', at: now - 10, profile: 'none' },
    { primary: '主驾温度控制', value: '22℃', at: now - 10, profile: 'fresh' },
    {
      primary: '主驾座椅加热',
      value: '1挡',
      at: now - 600001,
      profile: 'none',
    },
    { primary: '氛围灯亮度', value: '50%', at: now - 10, profile: 'none' },
  ];
  const choices = captureChoices(events, vehicle, 'none', now);
  assert.deepEqual(
    choices.map((c) => [c.primary, c.recent]),
    [
      ['音量', true],
      ['主驾座椅加热', false],
    ],
  );
  assert.equal(
    captureChoices(events, { ...vehicle, 音量: '30%' }, 'none', now).length,
    1,
  );
});
void test('observation evidence, cooldown, privacy, attention and negative preferences gate suggestions', () => {
  const s = story('half-song'),
    now = 1e12,
    state = freshLearning();
  assert.equal(observationReason(s, ctx, state, now), null);
  for (const st of [
    { ...state, enabled: false },
    { ...state, paused: true },
    { ...state, deleted: [s.id] },
    { ...state, refused: { [s.id]: now + 1 } },
    { ...state, lastOffered: now - 1 },
    { ...state, offers: { [s.id]: now - 1 } },
  ])
    assert.ok(observationReason(s, ctx, st, now));
  for (const evidence of [
    { ...s.evidence!, occurrences: 1 },
    { ...s.evidence!, opportunities: 10 },
    { ...s.evidence!, validated: false },
    { ...s.evidence!, ageDays: 15 },
    { ...s.evidence!, overlap: 0.6 },
  ])
    assert.ok(observationReason({ ...s, evidence }, ctx, state, now));
  assert.ok(observationReason(s, { ...ctx, driving: true }, state, now));
  assert.ok(observationReason(s, ctx, state, now, true));
  assert.ok(observationReason(s, ctx, state, now, false, true));
  assert.ok(
    observationReason(
      {
        ...s,
        actions: [
          { primary: '主驾车窗', secondary: '20%' },
          { primary: '音量', secondary: '20%' },
        ],
      },
      { ...ctx, profile: 'fresh' },
      state,
      now,
    ),
  );
  // Saving a habit is allowed even if settings already match today's state.
  assert.equal(
    observationReason(
      s,
      {
        ...ctx,
        vehicle: Object.fromEntries(
          s.actions.map((a) => [a.primary, a.secondary]),
        ),
      },
      state,
      now,
    ),
    null,
  );
});
void test('phase validator keeps cross-phase changes but rejects same-phase duplicates and invalid separators', () => {
  const s = sceneFrom(story('after-movement'));
  assert.equal(stages(s.actions).length, 2);
  assert.deepEqual(
    stages(s.actions)[1].items.map((i) => i.index),
    [3, 4],
  );
  const r = validateScene(s, ctx);
  assert.deepEqual(r.scene.actions, s.actions);
  const invalid = validateScene(
    {
      ...s,
      actions: [
        s.actions[0],
        { primary: '延时', secondary: '-1秒' },
        s.actions[3],
      ],
    },
    ctx,
  );
  assert.equal(executable(invalid), false);
  assert.equal(invalid.scene.actions.length, 1);
  const duplicate = validateScene(
    { ...s, actions: [s.actions[0], s.actions[3]] },
    ctx,
  );
  assert.equal(executable(duplicate), false);
  const revised = structuredClone(s);
  revised.actions[3].secondary = '1挡';
  assert.equal(revised.actions[0].secondary, '3挡');
  assert.ok(executable(validateScene(revised, ctx)));
});
void test('timed execution waits, supports per-device manual takeover, and undo cancels pending actions', () => {
  const s = sceneFrom(story('after-movement')),
    p = new ScenePlayback(s, VEHICLE_DEFAULTS);
  let v = p.advance(0, VEHICLE_DEFAULTS, ctx);
  assert.equal(v.前排风量调节, '3挡');
  assert.equal(v.主驾座椅通风, '2挡');
  v = p.advance(299, v, ctx);
  assert.equal(v.前排风量调节, '3挡');
  p.takeover('前排风量调节');
  v.前排风量调节 = '4挡';
  v = p.advance(1, v, ctx);
  assert.equal(v.前排风量调节, '4挡');
  assert.equal(v.主驾座椅通风, '1挡');
  v = p.undo(v);
  assert.equal(v.前排风量调节, '4挡');
  assert.equal(v.主驾座椅通风, VEHICLE_DEFAULTS.主驾座椅通风);
  assert.equal(p.pending.length, 0);
  const q = new ScenePlayback(s, VEHICLE_DEFAULTS);
  const start = q.advance(0, VEHICLE_DEFAULTS, ctx);
  assert.deepEqual(q.advance(300, q.undo(start), ctx), VEHICLE_DEFAULTS);
});
void test('future phases recheck driving policy and planned capabilities cannot execute', () => {
  const s = sceneFrom(story('breeze'));
  s.actions = [
    { primary: '音量', secondary: '20%' },
    { primary: '延时', secondary: '300秒' },
    { primary: '主驾车窗', secondary: '100%' },
  ];
  const p = new ScenePlayback(s, VEHICLE_DEFAULTS);
  const v = p.advance(0, VEHICLE_DEFAULTS, ctx);
  assert.throws(() => p.advance(300, v, { ...ctx, driving: true }));
  assert.equal(p.pending.length, 0);
  for (const a of [
    { primary: '低速行人警报音', secondary: '关闭' },
    { primary: '音乐播放', secondary: '放松' },
    { primary: '氛围灯颜色', secondary: '蓝色' },
  ])
    assert.equal(executable(validateScene({ ...s, actions: [a] }, ctx)), false);
});
void test('conditional activation is opt-in and rising-edge; a new trip can rearm it', () => {
  const s = sceneFrom(story('morning')),
    latch = new TriggerLatch();
  const v = { ...VEHICLE_DEFAULTS, ...story('morning').context };
  assert.equal(latch.check('a', false, s, v), false);
  assert.equal(latch.check('a', true, s, v), true);
  assert.equal(latch.check('a', true, s, v), false);
  assert.equal(latch.check('a', true, s, { ...v, 挡位: '挡位D' }), false);
  assert.equal(latch.check('a', true, s, v), true);
  latch.reset();
  assert.equal(latch.check('a', true, s, v), true);
  assert.equal(
    latch.check('manual', true, sceneFrom(story('breeze')), v),
    false,
  );
});
