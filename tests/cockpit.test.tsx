import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost:3100', pretendToBeVisual: true },
);
const win = dom.window;
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'HTMLInputElement',
  'Element',
  'Node',
  'MutationObserver',
  'getComputedStyle',
  'localStorage',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
])
  Object.defineProperty(globalThis, key, {
    value: key === 'window' ? win : (win as any)[key],
    configurable: true,
    writable: true,
  });
Object.defineProperty(globalThis, 'navigator', {
  value: win.navigator,
  configurable: true,
});
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: (fn: FrameRequestCallback) =>
    setTimeout(() => fn(0), 0),
  cancelAnimationFrame: clearTimeout,
  ResizeObserver: class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
});
win.matchMedia = () => ({
  matches: false,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return true;
  },
  media: '',
  onchange: null,
});
globalThis.fetch = async () =>
  Response.json({
    configured: false,
    models: [{ id: 'test/model', name: 'Test model' }],
    defaultModel: 'test/model',
  });
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { default: SceneStudio } = await import('../app/scene-studio');
let root: ReturnType<typeof createRoot>;
const buttons = () => [
  ...document.querySelectorAll<HTMLButtonElement>('button'),
];
const button = (name: string) => {
  const b = buttons().find(
    (b) =>
      b.getAttribute('aria-label') === name || b.textContent?.trim() === name,
  );
  assert.ok(b, 'Button exists: ' + name);
  return b;
};
async function click(name: string) {
  await act(async () => {
    button(name).click();
    await new Promise((r) => setTimeout(r, 5));
  });
}
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 740));
  });
}
async function type(label: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`,
  );
  assert.ok(input, label);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      win.HTMLInputElement.prototype,
      'value',
    )!.set!.call(input, value);
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
  });
}
async function mount(clear = true) {
  if (root) await act(async () => root.unmount());
  if (clear) localStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(<SceneStudio />));
}
const stored = () =>
  JSON.parse(localStorage.getItem('scene-studio.saved.v1') || '[]');

test('cockpit application interaction journeys', async (t) => {
  await t.test(
    'proposal floats over navigation; closing preserves draft and does not save',
    async () => {
      await mount();
      assert.equal(document.querySelectorAll('.proposal').length, 1);
      assert.ok(document.querySelector('.navigation-canvas'));
      assert.equal(stored().length, 0);
      await click('收起场景卡片');
      assert.ok(
        document.querySelector('.floating-proposal[aria-hidden="true"][inert]'),
      );
      await settle();
      assert.equal(document.querySelectorAll('.proposal').length, 0);
      await click('继续查看场景提案');
      assert.match(
        document.querySelector('.proposal')!.textContent!,
        /等你的片刻/,
      );
      assert.equal(stored().length, 0);
    },
  );
  await t.test(
    'save navigates into My Scenes; reopen and one-item edit preserves other actions',
    async () => {
      await mount();
      await click('就这样保存');
      assert.ok(document.querySelector('.saved-scene-list'));
      assert.equal(stored().length, 1);
      const saved = stored()[0];
      await act(async () =>
        document
          .querySelector<HTMLButtonElement>('.saved-scene-row>button')!
          .click(),
      );
      await click('改一下');
      await click('灯再暗一点');
      await settle();
      const card = document.querySelector('.proposal')!;
      assert.match(card.textContent!, /已修改/);
      await click('就这样保存');
      assert.equal(stored().length, 1);
      assert.equal(stored()[0].id, saved.id);
      assert.equal(stored()[0].result.scene.actions[0].secondary, '20%');
      assert.deepEqual(
        stored()[0].result.scene.actions.slice(1),
        saved.result.scene.actions.slice(1),
      );
    },
  );
  await t.test(
    'refresh restores saved scene and delete requires confirmation',
    async () => {
      await mount();
      await click('就这样保存');
      await mount(false);
      await click('场景应用');
      assert.equal(document.querySelectorAll('.saved-scene-row').length, 1);
      await click('删除场景 等你的片刻');
      assert.equal(stored().length, 1);
      assert.ok(document.querySelector('[role="dialog"]'));
      await click('保留');
      assert.equal(stored().length, 1);
      await click('删除场景 等你的片刻');
      await click('删除场景');
      assert.equal(stored().length, 0);
      assert.ok(document.querySelector('.empty-library'));
    },
  );
  await t.test(
    'in-app creation generates a single proposal; discard never saves',
    async () => {
      await mount();
      await click('场景应用');
      await click('创建场景');
      assert.ok(document.querySelector('input[aria-label="描述你想要的场景"]'));
      await click('雨夜回家');
      await settle();
      assert.match(
        document.querySelector('.proposal')!.textContent!,
        /雨夜归途/,
      );
      assert.match(document.querySelector('.proposal')!.textContent!, /提议中/);
      assert.equal(document.querySelectorAll('.proposal').length, 1);
      await click('不用');
      assert.equal(stored().length, 0);
      assert.ok(document.querySelector('.empty-library'));
    },
  );
  await t.test(
    'clarification stays in the same proposal and accepts a short answer',
    async () => {
      await mount();
      await click('打开演示设置');
      await click('试试追问');
      await settle();
      assert.match(
        document.querySelector('.proposal')!.textContent!,
        /你想打开空调、灯光，还是车窗/,
      );
      assert.equal(button('就这样保存').disabled, true);
      await click('灯光');
      await settle();
      assert.match(
        document.querySelector('.proposal')!.textContent!,
        /氛围灯开关/,
      );
      assert.equal(button('就这样保存').disabled, false);
    },
  );
  await t.test(
    'driving switches to three lines, preserves proposal, blocks creation',
    async () => {
      await mount();
      await click('打开演示设置');
      await act(async () =>
        document.querySelector<HTMLButtonElement>('[role="switch"]')!.click(),
      );
      await click('关闭面板');
      assert.equal(document.querySelectorAll('.drive-three-lines p').length, 3);
      assert.equal(document.querySelectorAll('.action-composition').length, 0);
      await click('场景应用');
      await click('创建场景');
      assert.ok(document.querySelector('.empty-library'));
      await click('打开演示设置');
      await act(async () =>
        document.querySelector<HTMLButtonElement>('[role="switch"]')!.click(),
      );
      await click('关闭面板');
      await click('导航应用');
      await click('继续查看场景提案');
      assert.ok(document.querySelector('.action-composition'));
    },
  );
  await t.test(
    'direct editing renames and modifies values without executing or saving',
    async () => {
      await mount();
      await click('改一下');
      await type('场景名称', '我的等待');
      await click('编辑主驾温度控制');
      await click('22℃');
      assert.match(document.querySelector('.proposal')!.textContent!, /22/);
      assert.equal(stored().length, 0);
      await click('就这样保存');
      assert.equal(stored()[0].result.scene.name, '我的等待');
      assert.equal(
        stored()[0].result.scene.actions.find(
          (a: any) => a.primary === '主驾温度控制',
        ).secondary,
        '22℃',
      );
    },
  );
  await t.test(
    'live mode without key reports connection error, never silently replays; explicit example restores example source',
    async () => {
      await mount();
      await click('打开演示设置');
      await click('真实 AI');
      await click('关闭面板');
      await click('场景应用');
      await click('创建场景');
      await type('描述你想要的场景', '自定义场景');
      await click('生成场景');
      await settle();
      assert.match(
        document.querySelector('[role="alert"]')!.textContent!,
        /尚未连接/,
      );
      assert.equal(stored().length, 0);
      await click('灵感场景');
      await act(async () =>
        document.querySelector<HTMLButtonElement>('.inspiration-1')!.click(),
      );
      await settle();
      assert.match(
        document.querySelector('.proposal')!.textContent!,
        /等你的片刻/,
      );
      assert.match(
        document.querySelector('.source-stamp')!.textContent!,
        /示例/,
      );
    },
  );
  await t.test(
    'profile preferences persist independently and can be restored',
    async () => {
      await mount();
      await click('场景应用');
      await click('它学会了什么');
      assert.ok(document.querySelector('.memory-empty'));
      await click('切换档案 周');
      assert.equal(document.querySelectorAll('.memory-row').length, 4);
      await click('停用偏好 主驾温度22℃');
      assert.equal(document.querySelectorAll('.memory-row.removed').length, 1);
      await click('用当前档案生成');
      await settle();
      await click('就这样保存');
      const actions = stored()[0].result.scene.actions;
      assert.equal(
        actions.find((a: any) => a.primary === '主驾温度控制').secondary,
        '24℃',
      );
      assert.equal(
        actions.find((a: any) => a.primary === '氛围灯亮度').secondary,
        '40%',
      );
      assert.equal(
        actions.find((a: any) => a.primary === '自动空气净化').secondary,
        '开启',
      );
      await click('切换档案 林');
      await click('它学会了什么');
      assert.equal(document.querySelectorAll('.memory-row.removed').length, 0);
      await click('停用偏好 不喜欢香氛，不要开香氛');
      await mount(false);
      await click('场景应用');
      await click('它学会了什么');
      assert.ok(button('切换档案 林').getAttribute('aria-pressed') === 'true');
      assert.equal(document.querySelectorAll('.memory-row.removed').length, 1);
      await click('切换档案 周');
      assert.ok(button('恢复偏好 主驾温度22℃'));
      await click('恢复偏好 主驾温度22℃');
      await click('用当前档案生成');
      await settle();
      await click('就这样保存');
      assert.equal(
        stored()[0].result.scene.actions.find(
          (a: any) => a.primary === '主驾温度控制',
        ).secondary,
        '22℃',
      );
      assert.equal(stored().length, 2);
    },
  );
  await t.test(
    'reopening during the exit animation cancels dismissal',
    async () => {
      await mount();
      await click('收起场景卡片');
      assert.ok(document.querySelector('.floating-proposal.is-leaving'));
      await click('继续查看场景提案');
      await settle();
      assert.equal(document.querySelectorAll('.proposal').length, 1);
      assert.ok(!document.querySelector('.floating-proposal.is-leaving'));
      assert.equal(stored().length, 0);
    },
  );
  await act(async () => root.unmount());
  dom.window.close();
});
