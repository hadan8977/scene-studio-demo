import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DEMO_CASES, sceneForCase } from '../lib/demo-cases.ts';
import {
  routeInput,
  controlResult,
  evaluateSuggestion,
  emptyAttention,
} from '../lib/intent-routing.ts';
import { capabilities, validateScene, type Context } from '../lib/scene.ts';
import { nonSceneRoute, generate } from '../lib/generation.ts';
import {
  similarScene,
  mergeScene,
  sceneDiff,
} from '../lib/scene-similarity.ts';
import {
  pointOnRoute,
  routeDistance,
  type Point,
} from '../lib/map-geometry.ts';
import type { SavedScene } from '../lib/storage.ts';
const parked: Context = { driving: false, profile: 'none' };
const driving: Context = { ...parked, driving: true };
const checked = (id: string, ctx = parked) =>
  validateScene(
    sceneForCase(id, ctx),
    ctx,
    DEMO_CASES.find((c) => c.id === id)!.input,
  );
const item = (id: string, caseId: string): SavedScene => ({
  id,
  input: DEMO_CASES.find((c) => c.id === caseId)!.input,
  result: checked(caseId),
  source: 'example',
  profileId: 'none',
  updatedAt: new Date().toISOString(),
});

void test('v17 examples cover varied registered capabilities and expose every unavailable request', () => {
  assert.ok(DEMO_CASES.filter((c) => c.entry === 'create').length >= 20);
  assert.ok(DEMO_CASES.filter((c) => c.entry === 'ambient').length >= 8);
  const used = new Set<string>();
  for (const c of DEMO_CASES.filter((c) => c.entry !== 'counter')) {
    const result = checked(c.id);
    assert.equal(result.savable, c.id !== 'boundary-distance', c.id);
    for (const action of result.scene.actions) {
      used.add(action.primary);
      const cap = capabilities.find((x) => x.zh === action.primary);
      assert.ok(cap, c.id + ': ' + action.primary);
      if (!['released', 'no_ux'].includes(cap.maturity))
        assert.ok(
          result.decisions.some(
            (d) =>
              d.primary === action.primary &&
              ['planned', 'proposed'].includes(d.status),
          ),
        );
    }
    for (const [primary] of c.actions || [])
      assert.ok(
        result.scene.actions.some((a) => a.primary === primary) ||
          result.decisions.some(
            (d) => d.primary === primary && d.final === undefined,
          ),
        c.id + ': never silently omit ' + primary,
      );
    assert.ok(
      result.scene.actions.filter(
        (a) =>
          !['released', 'no_ux'].includes(
            capabilities.find((c) => c.zh === a.primary)!.maturity,
          ),
      ).length <= 1,
    );
  }
  assert.ok(used.size >= 30, `Expected breadth, got ${used.size}`);
  assert.ok(
    checked('boundary-color').decisions.some((d) => d.status === 'unsupported'),
  );
  assert.ok(
    checked('boundary-safety').decisions.some((d) => d.status === 'forbidden'),
  );
});

void test('direct controls, official presets and vague car-control questions never become fresh scenes', () => {
  for (const c of DEMO_CASES.filter((c) => c.entry === 'counter'))
    assert.equal(routeInput(c.input, parked).kind, c.kind, c.id);
  assert.equal(routeInput('把灯调暗、温度24度', parked).kind, 'control');
  assert.equal(routeInput('做一个光和温度的场景', parked).kind, 'scene');
  assert.equal(routeInput('灯再暗一点', parked).kind, 'control');
  assert.equal(routeInput('打开灯光', parked).kind, 'control');
  assert.equal(
    nonSceneRoute({
      input: '灯再暗一点',
      context: parked,
      model: 'test',
      currentScene: sceneForCase('wait', parked),
    }),
    null,
    'Editing remains a continuation',
  );
  const preset = controlResult(routeInput('进入露营模式', parked), parked);
  assert.equal(preset.conceptual, true);
  assert.equal(preset.scene.actions.length, 1);
});

void test('service rejects direct controls before any model request', async () => {
  let requests = 0;
  await assert.rejects(
    generate(
      { input: '把灯调暗、温度24度', context: parked, model: 'test' },
      'unused',
      () => {},
      new AbortController().signal,
      async () => {
        requests++;
        return Response.json({});
      },
    ),
    /不会生成场景/,
  );
  assert.equal(requests, 0);
});

void test('weak context is distinct from emotion, relationships, physiology and driving fatigue', () => {
  for (const c of DEMO_CASES.filter((c) => c.entry === 'ambient'))
    assert.equal(routeInput(c.input, parked).kind, 'suggestion');
  for (const q of [
    '今天心情很不好',
    '今天是我们的纪念日',
    '又堵了，烦死了',
    '开车有点困',
  ])
    assert.equal(routeInput(q, driving).kind, 'chat');
  assert.equal(routeInput('我有点困', driving).kind, 'chat');
  assert.equal(routeInput('热死了', parked).kind, 'control');
  assert.equal(
    routeInput('今天心情不好，给我来点安静的氛围', parked).kind,
    'scene',
    'an explicit ambience request is not unsolicited emotional inference',
  );
  assert.equal(
    routeInput('车在太阳下晒了一下午，座椅都是烫的', parked).kind,
    'suggestion',
  );
});

void test('proactive gate respects current values, cross-element value, opt-out, cooldown and quota', () => {
  const c = DEMO_CASES.find((c) => c.id === 'ambient-wait')!,
    r = routeInput(c.input, parked),
    result = checked(c.id);
  assert.equal(
    evaluateSuggestion(r, result, parked, emptyAttention(), {}),
    null,
  );
  const same = Object.fromEntries(
    result.scene.actions.map((a) => [a.primary, a.secondary]),
  );
  assert.match(
    evaluateSuggestion(r, result, parked, emptyAttention(), same)!,
    /一类/,
  );
  assert.match(
    evaluateSuggestion(
      r,
      result,
      parked,
      { ...emptyAttention(), quiet: true },
      {},
    )!,
    /安静/,
  );
  assert.match(
    evaluateSuggestion(
      r,
      result,
      parked,
      { ...emptyAttention(), highLoad: true },
      {},
    )!,
    /负荷/,
  );
  assert.match(
    evaluateSuggestion(
      r,
      result,
      parked,
      { ...emptyAttention(), questions: 1 },
      {},
    )!,
    /额度/,
  );
  assert.match(
    evaluateSuggestion(
      r,
      result,
      parked,
      { ...emptyAttention(), refused: { wait: Date.now() + 10000 } },
      {},
    )!,
    /冷却/,
  );
  const negative = checked('fragrance', { ...parked, profile: 'quiet' });
  assert.match(
    evaluateSuggestion(r, negative, parked, emptyAttention(), {})!,
    /负面偏好/,
  );
  const rest = routeInput(
    DEMO_CASES.find((c) => c.id === 'ambient-rest')!.input,
    parked,
  );
  assert.equal(
    evaluateSuggestion(
      rest,
      checked('ambient-rest'),
      parked,
      emptyAttention(),
      {},
    ),
    null,
  );
  assert.match(
    evaluateSuggestion(
      rest,
      checked('ambient-rest'),
      driving,
      emptyAttention(),
      {},
    )!,
    /行驶中/,
  );
});

void test('similarity ignores active edit, compares conditions, and merge preserves unrelated settings', () => {
  const old = item('old', 'wait');
  assert.equal(similarScene(checked('simple').scene, [old])?.id, 'old');
  assert.equal(similarScene(checked('simple').scene, [old], 'old'), undefined);
  assert.equal(similarScene(checked('rain').scene, [old]), undefined);
  const next = checked('simple').scene;
  const merged = mergeScene(old.result.scene, next, parked);
  assert.equal(
    merged.scene.actions.find((a) => a.primary === '音量')?.secondary,
    '20%',
  );
  assert.equal(
    merged.scene.actions.find((a) => a.primary === '氛围灯亮度')?.secondary,
    '20%',
  );
  assert.equal(merged.scene.name, old.result.scene.name);
  assert.ok(
    sceneDiff(old.result.scene, next).some((d) => d.primary === '氛围灯亮度'),
  );
});

void test('car marker sits on continuous navigation geometry with the same projection and orientation', () => {
  const meta = JSON.parse(
    readFileSync(new URL('../public/map/source.json', import.meta.url), 'utf8'),
  );
  const route = meta.route as Point[];
  const expected = pointOnRoute(route, 0.2);
  assert.deepEqual(meta.vehicle, expected);
  assert.ok(routeDistance(meta.vehicle.point, route) < 1e-8);
  for (const f of [0, 0.1, 0.5, 0.85, 1])
    assert.ok(routeDistance(pointOnRoute(route, f).point, route) < 1e-8);
  const svg = readFileSync(
    new URL('../public/map/west-bund.svg', import.meta.url),
    'utf8',
  );
  assert.match(svg, /id="demo-vehicle"/);
  assert.ok(
    svg.includes('viewBox="0 0 1920 1000"'),
    'all geographic elements use one map viewBox',
  );
  const [x, y] = meta.projectedLandmark;
  assert.ok(
    Math.hypot(x - meta.vehicle.point[0], y - meta.vehicle.point[1]) > 50,
    'landmark is not a car marker',
  );
});
