import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_CASES, sceneForCase } from '../lib/demo-cases.ts';
import { validateScene } from '../lib/scene.ts';

const ctx = { driving: false, profile: 'none' as const };
const cutsOf = (id: string, input: string) =>
  validateScene(sceneForCase(id, ctx, input), ctx, input).decisions.filter(
    (d) => d.status === 'unsupported' || d.status === 'forbidden',
  );

/**
 * 内置用例是给人看的样板，不能出现当前能力表里不存在的动作或取值，
 * 否则演示第一眼就是一条“能力表不支持”。boundary-* 是故意演示边界的用例，
 * 它们反过来必须被拦下，所以单独断言。
 */
test('every built-in demo case survives the shipped capability table', () => {
  const offenders: string[] = [];
  for (const c of DEMO_CASES) {
    if (c.id.startsWith('boundary-')) continue;
    for (const d of cutsOf(c.id, c.input))
      offenders.push(`${c.id}: ${d.kind} ${d.primary}=${d.original} → ${d.reason}`);
  }
  assert.deepEqual(offenders, []);
});

test('boundary cases are still rejected by the shipped capability table', () => {
  for (const c of DEMO_CASES.filter((c) => c.id.startsWith('boundary-')))
    assert.ok(cutsOf(c.id, c.input).length > 0, c.id);
});
