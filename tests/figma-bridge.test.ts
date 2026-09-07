import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toViewResult, toViewSaved } from '../components/figma-make/bridge.ts';
import { emptyScene, validateScene } from '../lib/scene.ts';
import { exampleScene } from '../lib/examples.ts';

test('Figma presentation distinguishes forbidden, unsupported and adjusted decisions', () => {
  const ctx = { driving: true, profile: 'none' as const };
  const r = validateScene(exampleScene('boundary', ctx), ctx);
  const view = toViewResult(r);
  assert.ok(
    view.scene.unsupported.some(
      (a) => a.status === 'forbidden' && a.capability === '低速行人警报音',
    ),
  );
  assert.ok(view.scene.unsupported.some((a) => a.status === 'unsupported'));
  assert.equal(
    view.scene.actions.find((a) => a.capability === '主驾车窗')?.finalValue,
    '20%',
  );
  assert.equal(
    view.scene.actions.find((a) => a.capability === '主驾车窗')?.requested,
    '50%',
  );
});
test('an unrepresentable trigger remains visible and unsavable in the Figma card', () => {
  const r = validateScene(
    {
      ...emptyScene(),
      intent: 'precise',
      name: '到家之前',
      conditions: [{ primary: '导航剩余距离', op: '<=', secondary: '1km' }],
      actions: [{ primary: '音量', secondary: '20%' }],
    },
    { driving: false, profile: 'none' },
  );
  const view = toViewResult(r).scene;
  assert.equal(view.canSave, false);
  assert.ok(
    view.conditions.some(
      (c) => c.status === 'unsupported' && c.label.includes('导航剩余距离'),
    ),
  );
});
test('the presentation does not mutate the Appendix C scene or lose saved provenance', () => {
  const ctx = { driving: false, profile: 'fresh' as const };
  const r = validateScene(exampleScene('wait', ctx), ctx),
    before = structuredClone(r);
  const view = toViewSaved({
    id: 'legacy',
    input: '等人',
    source: 'example',
    result: r,
    updatedAt: '2026-09-07T00:00:00Z',
    profileId: 'fresh',
  });
  assert.equal(view.profileId, 'zhou');
  assert.equal(
    view.scene.memory.find((m) => m.id === 'zhou_temp')?.label,
    '主驾温度22℃',
  );
  assert.deepEqual(r, before);
});
