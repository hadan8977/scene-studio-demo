import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readProfileSettings } from '../lib/profile-settings.ts';
import { exampleScene } from '../lib/examples.ts';
import { validateScene, profileMemories } from '../lib/scene.ts';

test('profile removals affect only their own recommendations', () => {
  const ctx = {
    driving: false,
    profile: 'fresh' as const,
    ignoredMemories: ['主驾温度22℃'],
  };
  const result = validateScene(exampleScene('wait', ctx), ctx);
  const value = (primary: string) =>
    result.scene.actions.find((a) => a.primary === primary)?.secondary;
  assert.equal(value('主驾温度控制'), '24℃');
  assert.equal(value('氛围灯亮度'), '40%');
  assert.equal(value('自动空气净化'), '开启');
  assert.ok(!result.memoryUsed.includes('主驾温度22℃'));
  assert.ok(result.memoryUsed.includes('等人时氛围灯亮度40%'));
});

test('removing purification preserves temperature and light', () => {
  const s = exampleScene('wait', {
    driving: false,
    profile: 'fresh',
    ignoredMemories: ['喜欢自动空气净化'],
  });
  assert.equal(
    s.actions.find((a) => a.primary === '自动空气净化'),
    undefined,
  );
  assert.equal(
    s.actions.find((a) => a.primary === '主驾温度控制')?.secondary,
    '22℃',
  );
  assert.equal(
    s.actions.find((a) => a.primary === '氛围灯亮度')?.secondary,
    '40%',
  );
});

test('stored profile settings are validated and isolated by profile', () => {
  const settings = readProfileSettings(
    JSON.stringify({
      profile: 'quiet',
      removed: {
        quiet: [profileMemories.quiet[0].content, 'untrusted memory'],
        fresh: ['主驾温度22℃'],
      },
    }),
  );
  assert.equal(settings.profile, 'quiet');
  assert.deepEqual(settings.removed.quiet, [profileMemories.quiet[0].content]);
  assert.deepEqual(settings.removed.fresh, ['主驾温度22℃']);
  assert.equal(readProfileSettings('{broken').profile, 'none');
  assert.equal(readProfileSettings('{"profile":"injected"}').profile, 'none');
});
