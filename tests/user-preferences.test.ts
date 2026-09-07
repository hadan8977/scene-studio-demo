import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultPreferences,
  readPreferences,
  validPreference,
} from '../lib/user-preferences.ts';
import { readProfileSettings } from '../lib/profile-settings.ts';
import { memoriesFor, validateScene, emptyScene } from '../lib/scene.ts';
import { sceneForCase } from '../lib/demo-cases.ts';
import { inputFrom } from '../lib/generation.ts';

test('legacy removed preferences migrate without resurrecting a removed value', () => {
  const s = readProfileSettings(
    JSON.stringify({ profile: 'fresh', removed: { fresh: ['主驾温度22℃'] } }),
  );
  assert.equal(
    s.entries.fresh.find((p) => p.primary === '主驾温度控制')?.deleted,
    true,
  );
  assert.equal(
    s.entries.quiet.find((p) => p.primary === '主驾温度控制')?.deleted,
    false,
  );
});
test('edited values influence waiting suggestions and persist through profile serialization', () => {
  const prefs = defaultPreferences('fresh').map((p) =>
    p.primary === '主驾温度控制' ? { ...p, value: '25℃' } : p,
  );
  const s = readProfileSettings(
    JSON.stringify({ profile: 'fresh', entries: { fresh: prefs } }),
  );
  const ctx = {
    profile: 'fresh' as const,
    driving: false,
    preferences: s.entries.fresh,
  };
  const scene = sceneForCase('wait', ctx);
  assert.equal(
    scene.actions.find((a) => a.primary === '主驾温度控制')?.secondary,
    '25℃',
  );
  assert.ok(memoriesFor(ctx).some((p) => p.content === '主驾温度25℃'));
  assert.equal(
    s.entries.quiet.find((p) => p.primary === '主驾温度控制')?.value,
    '24℃',
  );
});
test('explicit empty preferences override the selected demo profile and never restore its defaults', () => {
  const ctx = { profile: 'fresh' as const, driving: false, preferences: [] };
  assert.deepEqual(memoriesFor(ctx), []);
  assert.equal(
    sceneForCase('wait', ctx).actions.find((a) => a.primary === '主驾温度控制')
      ?.secondary,
    '24℃',
  );
});
test('malformed preferences, duplicate active fields and disallowed negative types are rejected', () => {
  const p = { id: 'p', primary: '主驾温度控制', value: '25℃', negative: false };
  assert.ok(validPreference(p));
  assert.ok(!validPreference({ ...p, value: '99℃' }));
  assert.ok(!validPreference({ ...p, value: '22.1℃' }));
  assert.ok(!validPreference({ ...p, negative: true }));
  assert.ok(!validPreference({ ...p, primary: '氛围灯颜色' }));
  assert.equal(readPreferences([p, { ...p, id: 'duplicate' }, null]).length, 1);
  assert.equal(
    readPreferences([
      { ...p, deleted: true },
      { ...p, id: 'active' },
    ]).length,
    2,
  );
});
test('manually added negative preference blocks conflicting actions and deleted preferences do not', () => {
  const p = { id: 'p', primary: '香氛开关', value: '关闭', negative: true };
  const ctx = { profile: 'none' as const, driving: false, preferences: [p] };
  const s = {
    ...emptyScene(),
    name: '清新',
    intent: 'precise',
    actions: [{ primary: '香氛开关', secondary: '开启' }],
  };
  assert.equal(validateScene(s, ctx).scene.actions.length, 0);
  assert.equal(
    validateScene(s, { ...ctx, preferences: [{ ...p, deleted: true }] }).scene
      .actions.length,
    1,
  );
});
test('server accepts valid editable context and rejects injected out-of-range preferences', () => {
  const body = {
    input: '创建一个等候场景',
    model: 'test/model',
    context: {
      profile: 'fresh',
      driving: false,
      preferences: defaultPreferences('fresh'),
    },
  };
  assert.equal(inputFrom(body).context.preferences?.length, 4);
  assert.throws(() =>
    inputFrom({
      ...body,
      context: {
        ...body.context,
        preferences: [
          { id: 'x', primary: '主驾温度控制', value: '999℃', negative: false },
        ],
      },
    }),
  );
});
