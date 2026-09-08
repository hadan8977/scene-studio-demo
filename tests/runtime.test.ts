import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Part1Client, toProductResult, editScope } from '../lib/runtime-client.ts';
import { emptyScene } from '../lib/scene.ts';
import { toViewResult } from '../components/figma-make/bridge.ts';
import type { GenerationEvent } from '../lib/generation.ts';

const scene = { ...emptyScene(), name: '暖座', intent: 'action', understanding: '只调主驾座椅一挡', actions: [{ primary: '主驾座椅加热', secondary: '1挡' }] };
const reference = { proposal_id: 'p1', registry_revision: 'rev1', valid: true, savable: true, executable: true, scene, decisions: [], provenance: { timing: { ttft: 1, understanding: 1.1, total: 1.8 } }, trace: [{ layer: 'validator', status: 'pass' }] };

void test('runtime bridge preserves invalid trigger and cannot promote a blocked proposal', () => {
  const raw = { ...reference, valid: false, savable: false, executable: false, scene: { ...scene, conditions: [{ primary: '不存在的条件', secondary: 'x', op: '==' }] }, decisions: [{ status: 'blocked', reason: '条件不支持', capability: '不存在的条件' }] };
  const result = toProductResult(raw);
  assert.equal(result.savable, false); assert.equal(result.runtime?.executable, false);
  assert.deepEqual(result.scene.conditions, raw.scene.conditions);
  assert.equal(result.decisions[0].status, 'forbidden');
});

void test('runtime bridge streams understanding and complete validation with server-only auth', async () => {
  const requests: { path: string; body: Record<string, unknown> }[] = [], events: GenerationEvent[] = [];
  const client = new Part1Client('http://127.0.0.1:8787', 'fixture-secret', (async (url, options) => {
    assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer fixture-secret');
    const path = new URL(String(url)).pathname, body = JSON.parse(options?.body as string);
    requests.push({ path, body });
    if (path === '/demo/context') return Response.json({ ok: true });
    assert.equal(path, '/generate');
    const messages = [{ type: 'request', request_id: 'p1' }, { type: 'understanding', text: scene.understanding }, { type: 'result', result: reference }];
    return new Response(messages.map(m => 'data: ' + JSON.stringify(m) + '\n\n').join(''));
  }) as typeof fetch);
  await client.generate({ input: '主驾座椅加热一挡', model: 'deepseek-v4-flash', context: { driving: false, profile: 'quiet' }, existingScenes: [{ id: 's1', scene }] }, e => events.push(e), new AbortController().signal);
  assert.deepEqual(events.map(e => e.type), ['understanding', 'result']);
  assert.equal(requests[0].path, '/demo/context');
  assert.equal((requests[0].body.saved_scenes as unknown[]).length, 1);
  assert.equal((requests[0].body.memories as { value: string; primary?: string }[]).find(m => m.primary === '香氛开关')?.value, '开启');
  assert.equal(requests[1].body.source, 'explicit');
  assert.equal(events[1].type === 'result' && events[1].result.runtime?.proposalId, 'p1');
  assert.equal(JSON.stringify(events).includes('fixture-secret'), false);
});

void test('runtime errors do not fall back to local p13 or fixtures', async () => {
  let calls = 0;
  const client = new Part1Client('http://127.0.0.1:8787', 'fixture', (async () => { calls++; return Response.json({ error: 'Registry changed' }, { status: 409 }); }) as typeof fetch);
  await assert.rejects(client.generate({ input: 'hello', model: 'deepseek-v4-flash', context: { driving: false, profile: 'none' } }, () => {}, new AbortController().signal), /Registry changed/);
  assert.equal(calls, 1);
});

void test('one-item edits expose only the named device to the runtime', () => {
  const previous = { ...scene, actions: [{ primary: '氛围灯亮度', secondary: '20%' }, { primary: '主驾温度控制', secondary: '24℃' }] };
  assert.deepEqual(editScope('灯再暗一点', previous), ['氛围灯亮度']);
  assert.deepEqual(editScope('再改改', previous), []);
});

void test('runtime decisions carry the accepted value so the card does not list every item as unsupported', () => {
  const raw = { ...reference, decisions: [{ status: 'accepted', reason: '通过当前注册表与值域校验', capability: '主驾座椅加热' }] };
  const result = toProductResult(raw);
  assert.equal(result.decisions[0].final, '1挡');
  assert.equal(toViewResult(result).scene.unsupported.length, 0);
});

void test('a blocked capability drops its accepted twin and keeps both layers of reason on one row', () => {
  const raw = { ...reference, valid: false, savable: false, scene: { ...scene, actions: [{ primary: '主驾车窗', secondary: '100%' }] },
    decisions: [
      { status: 'blocked', reason: '行驶中车窗最多20%', capability: '主驾车窗' },
      { status: 'accepted', reason: '通过当前注册表与值域校验', capability: '主驾车窗' },
      { status: 'blocked', reason: '输入注入检测命中', capability: null },
      { status: 'blocked', reason: '输入有指令注入标记，不执行其任何片段', capability: null },
    ] };
  const result = toProductResult(raw);
  assert.deepEqual(result.decisions.map((d) => d.primary), ['主驾车窗', '提案']);
  assert.equal(result.decisions[0].status, 'forbidden');
  assert.equal(result.decisions[1].reason, '输入注入检测命中；输入有指令注入标记，不执行其任何片段');
  const view = toViewResult(result);
  assert.equal(view.scene.unsupported.length, 2);
  assert.equal(view.scene.blockReason, '行驶中车窗最多20%；输入注入检测命中；输入有指令注入标记，不执行其任何片段');
});
