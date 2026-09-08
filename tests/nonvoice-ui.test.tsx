import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', {
  url: 'http://localhost:3005',
  pretendToBeVisual: true,
});
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Node',
  'localStorage',
  'Event',
])
  Object.defineProperty(globalThis, key, {
    value: key === 'window' ? dom.window : Reflect.get(dom.window, key),
    configurable: true,
    writable: true,
  });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const disconnected = async () =>
  Response.json({
    configured: false,
    models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek' }],
    defaultModel: 'deepseek-v4-flash',
  });
globalThis.fetch = disconnected;
const { act, useLayoutEffect } = await import('react'),
  { createRoot } = await import('react-dom/client');
const { useGeneration } =
  await import('../components/figma-make/useGeneration');
let gen: ReturnType<typeof useGeneration>,
  root: ReturnType<typeof createRoot> | undefined;
function Harness() {
  const current = useGeneration();
  useLayoutEffect(() => {
    gen = current;
  });
  return null;
}
async function update(fn: () => unknown) {
  await act(async () => {
    await fn();
  });
}
async function mount(clear = true) {
  if (root) await update(() => root!.unmount());
  if (clear) localStorage.clear();
  globalThis.fetch = disconnected;
  root = createRoot(document.getElementById('root')!);
  await update(() => root!.render(<Harness />));
}
const saved = () =>
  JSON.parse(localStorage.getItem('scene-studio.saved.v1') || '[]');

void test('nonvoice state journeys', async (t) => {
  await t.test(
    'all seven stories independently save without applying or navigating',
    async () => {
      for (const id of [
        'half-song',
        'after-movement',
        'breeze',
        'workplace',
        'together',
        'morning',
        'waiting',
      ]) {
        await mount();
        await update(() => gen.nonVoice.loadStory(id));
        const before = { ...gen.experience.vehicle };
        await update(() =>
          gen.nonVoice.story!.entry === 'capture'
            ? gen.nonVoice.capture()
            : gen.nonVoice.openObservation(),
        );
        assert.ok(gen.nonVoice.draft, id);
        await update(() => gen.nonVoice.save());
        assert.equal(saved().length, 1, id);
        assert.deepEqual(
          gen.experience.vehicle,
          before,
          id + ' save does not apply',
        );
        assert.equal(gen.experience.viewRequest, 0);
        assert.equal(saved()[0].origin.automatic, false);
      }
    },
  );
  await t.test(
    'capture crop, value edit, name, optional older controls and single item persist',
    async () => {
      await mount();
      await update(() => gen.nonVoice.loadStory('waiting'));
      await update(() => gen.nonVoice.capture());
      assert.ok(!gen.nonVoice.selected.includes('主驾座椅加热'));
      assert.ok(gen.nonVoice.choices.some((c) => !c.recent));
      for (const p of [...gen.nonVoice.selected].filter(
        (p) => p !== '主驾温度控制',
      ))
        await update(() => gen.nonVoice.toggleCapture(p));
      await update(() =>
        gen.nonVoice.changeScene({
          ...gen.nonVoice.draft!.scene,
          name: '等一小会',
          actions: [{ primary: '主驾温度控制', secondary: '22℃' }],
        }),
      );
      await update(() => gen.nonVoice.save());
      assert.equal(saved()[0].result.scene.actions.length, 1);
      assert.equal(saved()[0].result.scene.actions[0].secondary, '22℃');
      await mount(false);
      assert.equal(gen.controller.saved[0].result.scene.name, '等一小会');
      await update(() => gen.nonVoice.openSaved(gen.controller.saved[0]));
      assert.equal(gen.nonVoice.draft!.origin.entry, 'capture');
    },
  );
  await t.test(
    'discard, empty capture, return to default and privacy create no saved state',
    async () => {
      await mount();
      await update(() => gen.nonVoice.capture());
      assert.match(gen.nonVoice.note, /先调好/);
      await update(() => gen.nonVoice.manual('音量', '20%'));
      const originalNow = Date.now;
      try {
        Date.now = () => originalNow() + 601000;
        await update(() => gen.nonVoice.capture());
        assert.equal(gen.nonVoice.selected.length, 0);
        assert.ok(gen.nonVoice.choices.every((c) => !c.recent));
      } finally {
        Date.now = originalNow;
      }
      await update(() => gen.nonVoice.close());
      await update(() => gen.nonVoice.manual('音量', '30%'));
      assert.equal(gen.nonVoice.choices.length, 0);
      await update(() => gen.nonVoice.loadStory('breeze'));
      await update(() => gen.nonVoice.capture());
      await update(() => gen.nonVoice.close());
      assert.equal(saved().length, 0);
      await update(() => gen.nonVoice.loadStory('half-song'));
      await update(() => gen.nonVoice.pause(true));
      assert.ok(gen.nonVoice.reason);
      await update(() => gen.nonVoice.openObservation());
      assert.equal(gen.nonVoice.draft, null);
    },
  );
  await t.test(
    'observation reject, delete evidence, learning off and insufficient evidence block reentry',
    async () => {
      await mount();
      await update(() => gen.nonVoice.loadStory('half-song'));
      await update(() => gen.nonVoice.openObservation());
      await update(() => gen.nonVoice.close(true));
      await update(() => gen.nonVoice.loadStory('half-song'));
      assert.ok(gen.nonVoice.reason);
      await update(() => gen.nonVoice.resetEvidence());
      assert.equal(gen.nonVoice.reason, null);
      await update(() => gen.nonVoice.setSimEvidence('insufficient'));
      assert.ok(gen.nonVoice.reason);
      await update(() => gen.nonVoice.resetEvidence());
      await update(() => gen.nonVoice.deleteEvidence());
      assert.ok(gen.nonVoice.reason);
      await update(() => gen.nonVoice.resetEvidence());
      await update(() => gen.nonVoice.setLearning(false));
      await update(() => gen.nonVoice.loadStory('morning'));
      assert.ok(gen.nonVoice.reason);
    },
  );
  await t.test(
    'phase-specific edit, manual takeover, chapter jump and undo preserve the user adjustment',
    async () => {
      await mount();
      await update(() => gen.nonVoice.loadStory('after-movement'));
      await update(() => gen.nonVoice.openObservation());
      const scene = structuredClone(gen.nonVoice.draft!.scene);
      scene.actions[3].secondary = '1挡';
      await update(() => gen.nonVoice.changeScene(scene));
      await update(() => gen.nonVoice.save());
      await update(() => gen.nonVoice.apply());
      assert.equal(gen.experience.vehicle.前排风量调节, '3挡');
      assert.ok(gen.nonVoice.pending);
      await update(() => gen.nonVoice.manual('前排风量调节', '4挡'));
      await update(() => gen.nonVoice.advance());
      assert.equal(gen.experience.vehicle.前排风量调节, '4挡');
      assert.equal(gen.experience.vehicle.主驾座椅通风, '1挡');
      await update(() => gen.nonVoice.undo());
      assert.equal(gen.experience.vehicle.前排风量调节, '4挡');
      assert.equal(gen.experience.vehicle.主驾座椅通风, '2挡');
      assert.equal(gen.nonVoice.pending, false);
    },
  );
  await t.test(
    'automatic usage remains opt-in and repeated condition ticks do not reapply',
    async () => {
      await mount();
      await update(() => gen.nonVoice.loadStory('morning'));
      await update(() => gen.nonVoice.openObservation());
      await update(() => gen.nonVoice.setAutomatic(true));
      await update(() => gen.nonVoice.save());
      await update(() => gen.nonVoice.nextTrip());
      assert.equal(gen.experience.vehicle.主驾温度控制, '22℃');
      assert.ok(saved()[0].origin.lastTriggeredAt);
      await update(() => gen.nonVoice.undo());
      assert.equal(gen.experience.vehicle.主驾温度控制, '24℃');
      await update(() => gen.nonVoice.checkConditions());
      assert.equal(gen.experience.vehicle.主驾温度控制, '24℃');
      await update(() => gen.nonVoice.toggleSavedAuto(gen.controller.saved[0]));
      await update(() => gen.nonVoice.nextTrip());
      assert.equal(gen.experience.vehicle.主驾温度控制, '24℃');
    },
  );
  await t.test(
    'driving capture is an inbox draft only and parked reopening can save it',
    async () => {
      await mount();
      await update(() => gen.setDriving('driving'));
      await update(() => gen.nonVoice.loadStory('together'));
      await update(() => gen.nonVoice.capture());
      assert.equal(saved().length, 0);
      assert.equal(gen.experience.inbox.length, 1);
      assert.match(gen.nonVoice.note, /停车后整理/);
      await update(() => gen.setDriving('parked'));
      await update(() => gen.nonVoice.openSaved(gen.experience.inbox[0], true));
      await update(() => gen.nonVoice.save());
      assert.equal(saved().length, 1);
      assert.equal(gen.experience.inbox.length, 0);
    },
  );
  await t.test(
    'late AI names and failed connections never replace an edited snapshot',
    async () => {
      await mount();
      await update(() => gen.nonVoice.loadStory('breeze'));
      await update(() => gen.nonVoice.capture());
      let resolve!: (v: Response) => void;
      globalThis.fetch = () =>
        new Promise((r) => {
          resolve = r;
        });
      let pending!: Promise<void>;
      await update(() => {
        pending = gen.nonVoice.nameWithAI();
      });
      await update(() =>
        gen.nonVoice.changeScene({
          ...gen.nonVoice.draft!.scene,
          name: '我起的名字',
        }),
      );
      await update(async () => {
        resolve(Response.json({ name: '晚到的 AI' }));
        await pending;
      });
      assert.equal(gen.nonVoice.draft!.scene.name, '我起的名字');
      assert.equal(gen.nonVoice.draft!.source, 'example');
      globalThis.fetch = async () => {
        throw Error('网络断开');
      };
      await update(() => gen.nonVoice.nameWithAI());
      assert.match(gen.nonVoice.note, /网络断开/);
      await update(() => gen.nonVoice.save());
      assert.equal(saved()[0].result.scene.name, '我起的名字');
    },
  );
  await update(() => root!.unmount());
  dom.window.close();
});
