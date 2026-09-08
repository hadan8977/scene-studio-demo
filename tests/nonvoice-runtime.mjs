import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { spawn } from 'node:child_process';
import { STORIES, sceneFrom, VEHICLE_DEFAULTS } from '../lib/nonvoice.ts';
import { POST as nonvoice } from '../app/api/nonvoice/route.ts';
import { POST as operation } from '../app/api/runtime/route.ts';
const runtimeDir = process.env.PART1_RUNTIME_DIR;
if (!runtimeDir)
  throw Error('Set PART1_RUNTIME_DIR to the matching runtime checkout');
const temporary = await mkdtemp(join(tmpdir(), 'nonvoice-runtime-'));
const scene = sceneFrom(STORIES.find((s) => s.id === 'after-movement'));
await writeFile(join(temporary, 'fixture.json'), JSON.stringify(scene));
const token = 'nonvoice-local-integration-only';
const port = Number(process.env.PART1_TEST_PORT || 8791);
process.env.PART1_RUNTIME_URL = `http://127.0.0.1:${port}`;
process.env.PART1_RUNTIME_TOKEN = token;
delete process.env.DEEPSEEK_API_KEY;
const child = spawn(
  process.env.PART1_PYTHON || 'python',
  [
    'server.py',
    '--port',
    String(port),
    '--fixture',
    join(temporary, 'fixture.json'),
    '--storage',
    join(temporary, 'state'),
  ],
  {
    cwd: runtimeDir,
    env: { ...process.env, PART1_RUNTIME_TOKEN: token },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let error = '';
child.stderr.on('data', (chunk) => {
  error += chunk.toString();
});
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error(error || 'Runtime startup timed out')),
      12000,
    );
    child.once('error', reject);
    child.once('exit', () => {
      clearTimeout(timeout);
      reject(Error(error || 'Runtime stopped'));
    });
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  const context = {
    profile: 'none',
    driving: false,
    vehicle: { ...VEHICLE_DEFAULTS },
  };
  const request = (body) =>
    new Request('http://localhost:3005/api/nonvoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const response = await nonvoice(
    request({
      kind: 'observation',
      scene,
      context,
      model: 'deepseek-v4-flash',
      evidence: STORIES[1].evidence,
      existingScenes: [],
    }),
  );
  const named = await response.json();
  assert.equal(response.status, 200, JSON.stringify(named));
  assert.ok(named.runtime.valid);
  assert.equal(named.name, scene.name);
  const result = { scene, runtime: named.runtime };
  async function run(op, extra = {}) {
    const response = await operation(
      request({ ...result, context, operation: op, ...extra }),
    );
    const data = await response.json();
    assert.equal(response.status, 200, JSON.stringify(data));
    return data;
  }
  const saved = await run('save');
  assert.equal(saved.vehicle.前排风量调节, '2挡');
  const applied = await run('apply_once');
  assert.equal(applied.vehicle.前排风量调节, '3挡');
  assert.equal(applied.vehicle.主驾座椅通风, '2挡');
  assert.equal(
    applied.timeline.filter((j) => j.status === 'pending').length,
    2,
  );
  await run('manual', { values: { 前排风量调节: '4挡' } });
  const later = await run('advance', { seconds: 300 });
  assert.equal(later.vehicle.前排风量调节, '4挡');
  assert.equal(later.vehicle.主驾座椅通风, '1挡');
  const restored = await run('restore');
  assert.equal(restored.vehicle.前排风量调节, '4挡');
  assert.equal(restored.vehicle.主驾座椅通风, '关闭');
  const morning = sceneFrom(STORIES.find((s) => s.id === 'morning'));
  const args = {
    scene: morning,
    context: { ...context, vehicle: { ...VEHICLE_DEFAULTS, 时段: '清晨' } },
    savedScenes: [{ id: 'morning', scene: morning }],
  };
  const triggered = await run('trigger', { ...args, newTrip: true });
  assert.ok(triggered.proposal_id);
  assert.ok(triggered.registry_revision);
  assert.equal(triggered.vehicle.主驾温度控制, '22℃');
  const repeated = await run('trigger', args);
  assert.equal(repeated.proposal_id, undefined);
  const closed = await run('trigger', {
    ...args,
    savedScenes: [],
    newTrip: true,
  });
  assert.equal(closed.proposal_id, undefined);
  const denied = await nonvoice(
    request({
      kind: 'capture',
      scene: {
        ...scene,
        actions: [{ primary: '低速行人警报音', secondary: '关闭' }],
      },
      context,
      model: 'deepseek-v4-flash',
    }),
  );
  assert.equal(denied.status, 400);
  const missing = await nonvoice(
    request({ kind: 'capture', scene, context, model: 'deepseek-v4-flash' }),
  );
  assert.equal(missing.status, 503);
  const foreign = await nonvoice(
    new Request('http://localhost:3005/api/nonvoice', {
      method: 'POST',
      headers: { Origin: 'https://example.invalid' },
      body: '{}',
    }),
  );
  assert.equal(foreign.status, 403);
  console.log(
    JSON.stringify({
      provider: 'offline_fixture',
      observation: 'passed',
      save: 'no execution',
      phases: 'passed',
      manualOverride: 'passed',
      restore: 'passed',
      trigger: 'passed',
      disabled: 'passed',
      forbidden: 'blocked',
      unconfigured: '503',
      origin: '403',
    }),
  );
} finally {
  if (child.exitCode === null)
    await new Promise((done) => {
      child.once('exit', done);
      child.kill();
    });
  const target = resolve(temporary);
  assert.equal(dirname(target), resolve(tmpdir()));
  assert.ok(basename(target).startsWith('nonvoice-runtime-'));
  await rm(target, { recursive: true, force: true });
}
