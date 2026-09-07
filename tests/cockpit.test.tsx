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
  'SVGElement',
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
    setTimeout(() => fn(performance.now()), 16),
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
  const b = buttons()
    .filter((b) => !b.closest('[hidden],[inert]'))
    .find(
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
    await new Promise((r) => setTimeout(r, 800));
  });
}
async function type(label: string, value: string) {
  const input = [
    ...document.querySelectorAll<HTMLInputElement>(
      `input[aria-label="${label}"]`,
    ),
  ].find((e) => !e.closest('[hidden],[inert]'));
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

const visible = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].filter(
    (el) => !el.closest('[hidden],[inert]'),
  );
const card = () => visible('[aria-label="场景生成卡片"]')[0];
async function generate(text = '等人时，帮我布置得舒服一点') {
  await type('描述你想要的场景', text);
  await click('生成场景');
  await settle();
}

test('Figma Make foundation with the production scene controller', async (t) => {
  await t.test(
    'uses the supplied frame and compact popup with idle command bar',
    async () => {
      await mount();
      const frame = document.querySelector<HTMLElement>(
        '[data-testid="hmi-frame"]',
      )!;
      assert.equal(frame.style.width, '1920px');
      assert.match(frame.style.transform, /rotateX\(2.5deg\) rotateY\(-5deg\)/);
      assert.equal(visible('[aria-label="场景生成卡片"]').length, 0);
      await generate();
      assert.match(card().textContent!, /等你的片刻/);
      assert.ok(
        visible('[data-testid="service-popup"]')[0].classList.contains(
          'w-[520px]',
        ),
      );
      assert.equal(stored().length, 0);
      await click('收起场景卡片');
      await settle();
      assert.equal(visible('[data-testid="service-popup"]').length, 0);
      await click('继续查看场景提案');
      await settle();
      assert.equal(visible('[aria-label="场景生成卡片"]').length, 1);
    },
  );

  await t.test(
    'view switching preserves draft; a local edit changes one action and save opens the library',
    async () => {
      await mount();
      await generate();
      await click('场景应用');
      await settle();
      assert.equal(visible('[role="dialog"][aria-label="场景编辑"]').length, 1);
      await click('改一下');
      await type('修改当前场景', '灯再暗一点');
      await click('提交修改');
      await settle();
      await click('就这样保存');
      await settle();
      assert.equal(visible('[role="dialog"][aria-label="场景编辑"]').length, 0);
      assert.equal(stored().length, 1);
      const actions = stored()[0].result.scene.actions;
      assert.equal(
        actions.find((a: any) => a.primary === '氛围灯亮度').secondary,
        '20%',
      );
      assert.equal(
        actions.find((a: any) => a.primary === '音量').secondary,
        '20%',
      );
      assert.equal(
        actions.find((a: any) => a.primary === '主驾温度控制').secondary,
        '24℃',
      );
      await click('打开场景 等你的片刻');
      await settle();
      await click('改一下');
      await type('修改当前场景', '再凉一点');
      await click('提交修改');
      await settle();
      await click('就这样保存');
      await settle();
      assert.equal(stored().length, 1);
      assert.equal(
        stored()[0].result.scene.actions.find(
          (a: any) => a.primary === '主驾温度控制',
        ).secondary,
        '22℃',
      );
    },
  );

  await t.test(
    'saved scenes survive refresh and deletion needs the explicit delete button',
    async () => {
      await mount();
      await generate();
      await click('就这样保存');
      await settle();
      await mount(false);
      await click('场景应用');
      await settle();
      assert.ok(button('打开场景 等你的片刻'));
      await type('搜索我的场景', '不存在');
      assert.equal(visible('[aria-label="打开场景 等你的片刻"]').length, 0);
      await type('搜索我的场景', '');
      await click('删除场景 等你的片刻');
      assert.equal(stored().length, 1);
      await click('保留');
      assert.equal(stored().length, 1);
      await click('删除场景 等你的片刻');
      await click('删除场景');
      await settle();
      assert.equal(stored().length, 0);
    },
  );

  await t.test(
    'in-app creation and discard never create a saved entry',
    async () => {
      await mount();
      await click('场景应用');
      await click('一句话新建');
      await generate('做一个雨夜回家的场景');
      assert.match(card().textContent!, /雨夜归途/);
      assert.match(card().textContent!, /提议中/);
      await click('不用');
      await settle();
      assert.equal(stored().length, 0);
      assert.equal(visible('[role="dialog"][aria-label="场景编辑"]').length, 0);
    },
  );

  await t.test(
    'clarification continues the same proposal and English examples remain available',
    async () => {
      await mount();
      await generate('帮我把那个打开');
      assert.ok(visible('input[aria-label="补充场景信息"]').length);
      await type('补充场景信息', '灯光');
      await click('继续');
      await settle();
      assert.match(card().textContent!, /氛围灯开关/);
      await click('不用');
      await settle();
      await generate('Create a quiet scene for waiting in the car');
      assert.match(card().textContent!, /Quiet moment/);
    },
  );

  await t.test(
    'forbidden actions stay separate and driving has exactly three summary lines',
    async () => {
      await mount();
      await generate('把氛围灯改成蓝色，关闭行人警报音，车窗开到50%');
      assert.match(card().textContent!, /禁止/);
      assert.match(card().textContent!, /不支持/);
      await click('切换到行驶态');
      assert.equal(visible('[data-testid="driving-summary"] p').length, 3);
      assert.equal(visible('[aria-label="场景生成卡片"]').length, 0);
      assert.equal(button('生成场景').disabled, true);
      await click('切换到停车态');
      assert.match(card().textContent!, /20%/);
      await click('就这样保存');
      await settle();
      assert.deepEqual(stored()[0].result.scene.actions, [
        { primary: '主驾车窗', secondary: '20%' },
      ]);
    },
  );

  await t.test('direct fields edit the same checked scene', async () => {
    await mount();
    await generate();
    await click('改一下');
    await act(async () =>
      visible('[data-testid="scene-fields"] summary')[0].click(),
    );
    await type('场景名称', '周末等你');
    const select = visible(
      'select[aria-label="设置主驾温度控制"]',
    )[0] as HTMLSelectElement;
    await act(async () => {
      select.value = '22℃';
      select.dispatchEvent(new win.Event('change', { bubbles: true }));
    });
    assert.equal(stored().length, 0);
    await click('就这样保存');
    await settle();
    assert.equal(stored()[0].result.scene.name, '周末等你');
    assert.equal(
      stored()[0].result.scene.actions.find(
        (a: any) => a.primary === '主驾温度控制',
      ).secondary,
      '22℃',
    );
  });

  await t.test(
    'Figma learned page removes and restores granular persistent preferences',
    async () => {
      await mount();
      await click('场景应用');
      await click('它学会了什么');
      await click('切换档案 周');
      assert.equal(visible('[data-testid="memory-row"]').length, 4);
      await click('停用偏好 温度 22℃');
      await click('用当前档案生成');
      await settle();
      await click('就这样保存');
      await settle();
      const actions = stored()[0].result.scene.actions;
      assert.equal(
        actions.find((a: any) => a.primary === '主驾温度控制').secondary,
        '24℃',
      );
      assert.equal(
        actions.find((a: any) => a.primary === '氛围灯亮度').secondary,
        '40%',
      );
      assert.ok(actions.some((a: any) => a.primary === '自动空气净化'));
      await mount(false);
      await click('场景应用');
      await click('它学会了什么');
      assert.equal(button('切换档案 周').getAttribute('aria-pressed'), 'true');
      assert.ok(button('恢复偏好 温度 22℃'));
      await click('切换档案 林');
      assert.equal(visible('[data-removed="true"]').length, 0);
      await click('切换档案 周');
      await click('恢复偏好 温度 22℃');
      await click('用当前档案生成');
      await settle();
      await click('就这样保存');
      await settle();
      assert.equal(
        stored()[0].result.scene.actions.find(
          (a: any) => a.primary === '主驾温度控制',
        ).secondary,
        '22℃',
      );
    },
  );

  await t.test(
    'unconfigured real generation preserves input and never falls back silently',
    async () => {
      await mount();
      await click('打开评审设置');
      await click('真实 AI');
      await click('关闭评审设置');
      await settle();
      await generate('自由生成一份场景');
      assert.match(visible('[role="alert"]')[0].textContent!, /尚未连接/);
      assert.equal(
        (visible('input[aria-label="描述你想要的场景"]')[0] as HTMLInputElement)
          .value,
        '自由生成一份场景',
      );
      assert.equal(stored().length, 0);
      await click('打开评审设置');
      await click('示例模式');
      await click('关闭评审设置');
      await settle();
      await generate('把灯调暗、温度24度');
      assert.match(card().textContent!, /光和温度/);
    },
  );

  await t.test(
    'a newer submission wins while generation is pending',
    async () => {
      await mount();
      await type('描述你想要的场景', '做一个雨夜回家的场景');
      await click('生成场景');
      await type('描述你想要的场景', '做个安静场景，别吵醒后排');
      await click('生成场景');
      await settle();
      assert.match(card().textContent!, /轻一点/);
      assert.doesNotMatch(card().textContent!, /雨夜归途/);
      await click('就这样保存');
      await settle();
      assert.equal(stored()[0].result.scene.name, '轻一点');
    },
  );
  await act(async () => root.unmount());
  dom.window.close();
});
