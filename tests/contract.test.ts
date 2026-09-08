import { test } from 'node:test';
import assert from 'node:assert/strict';
import release from '../lib/data/p36-release.json' with { type: 'json' };
import { CONTRACT, capOf, overflows } from '../lib/contract.ts';

void test('contract limits match the frozen release record', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(CONTRACT)), release.contract);
});

void test('latin text gets the wide limit, chinese the narrow one', () => {
  assert.equal(capOf('Seat heating on', CONTRACT.say), 60);
  assert.equal(capOf('座椅加热开好了', CONTRACT.say), 30);
  assert.equal(overflows('x'.repeat(60), CONTRACT.say), false);
  assert.equal(overflows('x'.repeat(61), CONTRACT.say), true);
  assert.equal(overflows('好'.repeat(30), CONTRACT.say), false);
  assert.equal(overflows('好'.repeat(31), CONTRACT.say), true);
});

void test('the shipped registry is the round-three strikethrough build', () => {
  assert.equal(release.registryVersion, '2026-09-08.r3');
  assert.equal(release.model, 'deepseek-v4-flash');
  assert.equal(release.providers[0].via, 'deepseek-official');
  assert.equal(release.providers[0].keyEnv, 'DEEPSEEK_OFFICIAL_API_KEY');
  // 腾讯代理留作备用；它要求模型名首字母大写
  assert.equal(release.providers[1].via, 'tencent');
  assert.equal(release.providers[1].model, 'Deepseek-v4-flash');
  assert.ok(release.endpoint.startsWith('https://api.deepseek.com/'));
});
