import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyScene, validateScene } from '../lib/scene.ts';
import { exampleScene } from '../lib/examples.ts';
import { systemPrompt } from '../lib/generation.ts';
const ctx = { driving: false, profile: 'none' as const };
const proposal = (primary: string, secondary: string, condition = false) => ({
  ...emptyScene(),
  name: '检查',
  intent: 'precise',
  actions: condition
    ? [{ primary: '音量', secondary: '20%' }]
    : [{ primary, secondary }],
  conditions: condition ? [{ primary, secondary, op: '==' }] : [],
});

test('v16 time and calendar fields reject invalid clocks and dates, including placeholders', () => {
  for (const [primary, good, bad] of [
    ['生效时间', '07:30', '23:79'],
    ['生效时间段', '22:00-07:00', '自定义'],
    ['重复周期', '1,3,5', '1,1'],
    ['指定日期', '20280229', '20260229'],
    ['日期区间', '20260907-20260908', '20260908-20260907'],
  ]) {
    assert.equal(
      validateScene(proposal(primary, good, true), ctx).savable,
      true,
      primary,
    );
    const rejected = validateScene(proposal(primary, bad, true), ctx);
    assert.equal(rejected.savable, false, primary);
    assert.ok(rejected.scene.clarify);
  }
});

test('named songs preserve spaces, remain planned, and never accept a placeholder', () => {
  const accepted = validateScene(
    proposal('播放指定音乐', 'Here Comes the Sun'),
    ctx,
  );
  assert.equal(accepted.scene.actions[0].secondary, 'Here Comes the Sun');
  assert.equal(accepted.decisions[0].status, 'planned');
  assert.equal(accepted.conceptual, true);
  assert.equal(
    validateScene(proposal('播放指定音乐', '歌曲名'), ctx).savable,
    false,
  );
  assert.ok(!systemPrompt().includes('没有指定歌名'));
});

test('video and karaoke remain planned when parked and cannot open while driving', () => {
  for (const primary of [
    '本地视频',
    '腾讯视频',
    '爱奇艺',
    '唱吧',
    '全民K歌',
    '酷狗K歌',
    'YouTube',
  ]) {
    assert.equal(
      validateScene(proposal(primary, '打开'), ctx).decisions[0].status,
      'planned',
    );
    const r = validateScene(proposal(primary, '打开'), {
      ...ctx,
      driving: true,
    });
    assert.equal(r.savable, false);
    assert.equal(r.decisions[0].status, 'forbidden');
    assert.equal(
      validateScene(proposal(primary, '退出'), { ...ctx, driving: true })
        .savable,
      true,
    );
  }
});

test('unbound custom parameters cannot masquerade as complete actions or conditions', () => {
  for (const [primary, value, condition] of [
    ['声场', '自定义', false],
    ['导航目的地', '地点搜索', false],
    ['位置', '收藏地点', true],
    ['QQ音乐', '指定歌曲', false],
  ] as const)
    assert.equal(
      validateScene(proposal(primary, value, condition), ctx).savable,
      false,
    );
});

test('memory annotation stops claiming a preference after a value changes or an action is removed', () => {
  const profile = { ...ctx, profile: 'fresh' as const },
    raw = exampleScene('wait', profile);
  assert.ok(validateScene(raw, profile).memoryUsed.includes('主驾温度22℃'));
  raw.actions.find((a) => a.primary === '主驾温度控制')!.secondary = '24℃';
  raw.actions = raw.actions.filter((a) => a.primary !== '氛围灯亮度');
  const used = validateScene(raw, profile).memoryUsed;
  assert.ok(!used.includes('主驾温度22℃'));
  assert.ok(!used.includes('等人时氛围灯亮度40%'));
  assert.ok(used.includes('喜欢自动空气净化'));
});
