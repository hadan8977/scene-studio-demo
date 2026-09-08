import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { emptyScene, validateScene } from '../lib/scene';
import { PROMPT_INFO, type GenerateInput } from '../lib/generation';
import { preferenceValues, preferenceLabel } from '../lib/user-preferences';

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
  if (
    name.startsWith('体验 ') &&
    visible('[aria-label="主动服务示例"]').length
  ) {
    for (
      let page = 0;
      page < 3 &&
      !visible('button').some((b) => b.getAttribute('aria-label') === name);
      page++
    )
      await click('下一组示例');
  }
  if (
    name === '保存' &&
    !buttons().some(
      (b) => !b.closest('[hidden],[inert]') && b.textContent?.trim() === '保存',
    ) &&
    card()
  ) {
    await click('场景应用');
    await settle();
  }

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
async function select(label: string, value: string) {
  if (label.startsWith('偏好值 ')) {
    await click(label);
    await select('编辑偏好值', value);
    await click('保存偏好');
    return;
  }
  if (label === '偏好项目') {
    await click(label);
    await click('选择偏好 ' + preferenceLabel(value));
    return;
  }
  if (label === '编辑偏好值') {
    const range = visible(
      'input[type="range"][aria-label="编辑偏好值"]',
    )[0] as HTMLInputElement;
    if (range) {
      const primary = visible('[data-preference-primary]')[0].dataset
        .preferencePrimary!;
      const index = preferenceValues(primary).indexOf(value);
      assert.ok(index >= 0);
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          win.HTMLInputElement.prototype,
          'value',
        )!.set!.call(range, String(index));
        range.dispatchEvent(new win.Event('input', { bubbles: true }));
      });
    } else await click('偏好设为 ' + value);
    return;
  }

  const el = visible(`select[aria-label="${label}"]`)[0] as HTMLSelectElement;
  assert.ok(el, label);
  assert.ok(
    [...el.options].some((o) => o.value === value),
    label + ' allows ' + value,
  );
  await act(async () => {
    el.value = value;
    el.dispatchEvent(new win.Event('change', { bubbles: true }));
  });
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
  await click(
    visible('[aria-label="发送给小塔"]').length ? '发送给小塔' : '生成场景',
  );
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
          'w-[580px]',
        ),
      );
      assert.equal(stored().length, 0);
      await click('关闭场景卡片');
      await settle();
      assert.equal(visible('[data-testid="service-popup"]').length, 0);
      await generate();
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
      await click('编辑');
      await type('修改当前场景', '灯再暗一点');
      await click('提交修改');
      await settle();
      await click('保存');
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
      await click('编辑');
      await type('修改当前场景', '再凉一点');
      await click('提交修改');
      await settle();
      await click('保存');
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
      await click('保存');
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
      await click('新建场景');
      await generate('做一个雨夜回家的场景');
      assert.match(card().textContent!, /雨夜归途/);
      assert.match(card().textContent!, /提议中/);
      await click('关闭编辑窗口');
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
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /你想打开空调/,
      );
      await click('灯光');
      await settle();
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /氛围灯开关/,
      );
      assert.equal(card(), undefined);
      await click('清除对话');
      await settle();
      await generate('Create a quiet scene for waiting in the car');
      assert.match(card().textContent!, /Quiet moment/);
    },
  );

  await t.test(
    'forbidden actions stay separate and driving has exactly three summary lines',
    async () => {
      await mount();
      await generate('做个透气场景，车窗开到50%，关闭行人警报音');
      assert.match(card().textContent!, /不允许/);
      assert.doesNotMatch(card().textContent!, /氛围灯改成蓝色/);
      await click('切换到行驶态');
      assert.equal(visible('[data-testid="driving-summary"] p').length, 3);
      assert.equal(visible('[aria-label="场景生成卡片"]').length, 0);
      assert.equal(button('发送给小塔').disabled, true);
      await click('切换到停车态');
      assert.match(card().textContent!, /20%/);
      await click('保存');
      await settle();
      assert.deepEqual(stored()[0].result.scene.actions, [
        { primary: '主驾车窗', secondary: '20%' },
      ]);
    },
  );

  await t.test('direct fields edit the same checked scene', async () => {
    await mount();
    await generate();
    await click('编辑');

    await type('场景名称', '周末等你');
    const select = visible(
      'select[aria-label="设置主驾温度控制"]',
    )[0] as HTMLSelectElement;
    await act(async () => {
      select.value = '22℃';
      select.dispatchEvent(new win.Event('change', { bubbles: true }));
    });
    assert.equal(stored().length, 0);
    await click('保存');
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
      await click('删除偏好 温度');
      if (!card()) await click('查看方案');
      await settle();
      await click('保存');
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
      assert.ok(button('恢复偏好 温度'));
      await click('切换档案 林');
      assert.equal(visible('[data-removed="true"]').length, 0);
      await click('切换档案 周');
      await click('恢复偏好 温度');
      if (!card()) await click('查看方案');
      await settle();
      await click('保存');
      if (visible('[data-testid="duplicate-panel"]').length)
        await click('更新');
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
      assert.equal(card(), undefined);
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /已调好/,
      );
    },
  );

  await t.test(
    'a newer submission wins while generation is pending',
    async () => {
      await mount();
      await type('描述你想要的场景', '做一个雨夜回家的场景');
      await click('发送给小塔');
      await type('描述你想要的场景', '做个安静场景，别吵醒后排');
      await click('发送给小塔');
      await settle();
      assert.match(card().textContent!, /后排轻声/);
      assert.doesNotMatch(card().textContent!, /雨夜归途/);
      await click('保存');
      await settle();
      assert.equal(stored()[0].result.scene.name, '后排轻声');
    },
  );

  await t.test(
    'real map and inspiration lead into a compact proposal; normal continuation changes only one item',
    async () => {
      await mount();
      assert.equal(
        visible('[data-testid="real-map"] img')[0]?.getAttribute('src'),
        '/map/west-bund.svg',
      );
      assert.ok(
        visible('a[href="https://www.openstreetmap.org/copyright"]').length,
      );
      await click('场景应用');
      await click('试用示例 等你的片刻');
      await settle();
      assert.ok(visible('[aria-label="场景动作"]').length);
      assert.ok(!visible('[aria-label="空气与香氛的动作"]').length);
      await click('主动服务弹窗');
      await click('编辑');
      await type('修改当前场景', '灯再暗一点');
      await click('提交修改');
      await settle();
      assert.match(card().textContent!, /已更新/);
      await click('编辑');
      await click('小声一点');
      await settle();
      await click('保存');
      await settle();
      const saved = stored()[0].result.scene.actions;
      assert.equal(
        saved.find((a: any) => a.primary === '氛围灯亮度').secondary,
        '20%',
      );
      assert.equal(
        saved.find((a: any) => a.primary === '音量').secondary,
        '10%',
      );
      assert.equal(
        saved.find((a: any) => a.primary === '主驾温度控制').secondary,
        '24℃',
      );
    },
  );
  await t.test(
    'learning preview reacts to removal; reopening under different car state never overwrites storage',
    async () => {
      await mount();
      await click('场景应用');
      await click('切换档案 周');
      await click('它学会了什么');
      assert.match(
        visible('[aria-label="偏好影响预览"]')[0].textContent!,
        /22℃/,
      );
      await click('删除偏好 温度');
      assert.ok(
        !visible('[aria-label="偏好影响预览"]')[0].textContent!.includes('22℃'),
      );
      await click('切换档案 默认');
      await click('主动服务弹窗');
      await generate('做个透气场景，车窗开到50%，关闭行人警报音');
      await click('保存');
      await settle();
      await click('主动服务弹窗');
      await click('切换到行驶态');
      await click('场景应用');
      await settle();
      await click('关闭编辑窗口');
      await click('打开场景 安全限制也会保留');
      await settle();
      assert.match(
        visible('[data-testid="driving-summary"]')[0].textContent!,
        /20%/,
      );
      assert.equal(stored()[0].result.scene.actions[0].secondary, '50%');
    },
  );

  await t.test(
    'weak context opens the complete proposal immediately and applies only after confirmation',
    async () => {
      await mount();
      await click('切换档案 周');
      await click('体验 还要等一会儿');
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /先歇一会儿/,
      );
      assert.ok(card());
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1200));
      });
      assert.ok(button('好'));
      assert.ok(card());
      if (!card()) await click('查看方案');
      await click('好');
      assert.match(
        visible('[data-testid="vehicle-state"]')[0].textContent!,
        /40%/,
      );
      assert.match(
        visible('[data-testid="vehicle-state"]')[0].textContent!,
        /22℃/,
        'temperature applies immediately after confirmation',
      );
      await act(async () => {
        await new Promise((r) => setTimeout(r, 3200));
      });
      assert.match(
        visible('[data-testid="vehicle-state"]')[0].textContent!,
        /22℃/,
      );
      assert.equal(stored().length, 0);
      assert.equal(
        JSON.parse(localStorage.getItem('scene-studio.ideas.v1') || '[]')
          .length,
        1,
      );
      await click('保存');
      await settle();
      assert.equal(stored().length, 1);
      assert.equal(
        JSON.parse(localStorage.getItem('scene-studio.ideas.v1') || '[]')
          .length,
        0,
      );
    },
  );
  await t.test(
    'a later direct control wins after an immediate scene application',
    async () => {
      await mount();
      await click('切换档案 周');
      await click('体验 还要等一会儿');
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1200));
      });
      if (!card()) await click('查看方案');
      await click('好');
      await type('描述你想要的场景', '温度26度');
      await click('发送给小塔');
      await act(async () => {
        await new Promise((r) => setTimeout(r, 3300));
      });
      assert.match(
        visible('[data-testid="vehicle-state"]')[0].textContent!,
        /26℃/,
      );
      assert.doesNotMatch(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /本次已应用/,
      );
      assert.equal(card(), undefined);
      assert.equal(stored().length, 0);
      assert.equal(
        JSON.parse(localStorage.getItem('scene-studio.ideas.v1') || '[]')
          .length,
        1,
      );
    },
  );
  await t.test(
    'rejection cools down the same family while independent replay can start a fresh case',
    async () => {
      await mount();
      await click('体验 还要等一会儿');
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1200));
      });
      await click('关闭场景卡片');
      await settle();
      await generate('她说还要二十分钟');
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /先歇一会儿/,
      );
      assert.equal(card(), undefined);
      await click('清除对话');
      await click('体验 后排睡着了');
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1200));
      });
      assert.ok(button('好'));
    },
  );
  await t.test(
    'driving leaves full ideas in the persistent inbox and parked reopening is editable',
    async () => {
      await mount();
      await click('切换到行驶态');
      await click('体验 后排睡着了');
      await settle();
      assert.equal(card(), undefined);
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /停车后查看/,
      );
      assert.equal(
        JSON.parse(localStorage.getItem('scene-studio.ideas.v1') || '[]')
          .length,
        1,
      );
      await mount(false);
      await click('场景应用');
      await click('场景建议');
      assert.match(
        visible('[data-testid="ideas-inbox"]')[0].textContent!,
        /后排睡着了/,
      );
      await click('打开场景 后排睡着了');
      await settle();
      assert.ok(card());
      await click('关闭编辑窗口');
      await settle();
      assert.equal(stored().length, 0);
    },
  );
  await t.test(
    'existing scenes are reused before generation and duplicate save presents actual differences',
    async () => {
      await mount();
      await generate();
      await click('保存');
      await settle();
      await click('主动服务弹窗');
      await click('清除对话');
      await settle();
      await click('体验 还要等一会儿');
      await settle();
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /先歇一会儿/,
      );
      if (!card()) await click('查看方案');
      await click('编辑');
      await click('灯再暗一点');
      await settle();
      await click('保存');
      assert.match(
        visible('[data-testid="duplicate-panel"]')[0].textContent!,
        /30%.*20%/,
      );
      assert.equal(stored().length, 1);
      await click('更新');
      await settle();
      assert.equal(stored().length, 1);
      assert.equal(
        stored()[0].result.scene.actions.find(
          (a: any) => a.primary === '氛围灯亮度',
        ).secondary,
        '20%',
      );
    },
  );
  await t.test(
    'proposed and planned actions are never applied by the vehicle simulation',
    async () => {
      await mount();
      await click('场景应用');
      await click('试用示例 这一首歌');
      await settle();
      assert.match(card().textContent!, /规划中/);
      await click('保存');
      await settle();
      await click('打开场景 ' + stored()[0].result.scene.name);
      await settle();
      await click('好');
      await click('主动服务弹窗');
      await act(async () => {
        await new Promise((r) => setTimeout(r, 3300));
      });
      assert.doesNotMatch(
        visible('[data-testid="vehicle-state"]')[0].textContent!,
        /Here Comes the Sun/,
      );
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /已调好，可用功能已应用/,
      );
      assert.equal(stored().length, 1);
      await click('撤销');
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /已撤销/,
      );
    },
  );
  await t.test(
    'direct-control counterexample and forward reading view stay distinct from scene creation',
    async () => {
      await mount();
      await click('正视阅读');
      assert.match(
        visible('[data-testid="hmi-frame"]')[0].style.transform,
        /rotateY\(0deg\)/,
      );
      await click('直接车控');
      await click('体验 直接调灯与温度');
      assert.match(
        visible('[data-testid="vehicle-state"]')[0].textContent!,
        /20%.*24℃/,
      );
      assert.equal(card(), undefined);
      assert.equal(stored().length, 0);
    },
  );
  await t.test(
    'quiet mode suppresses suggestions and explicit scene creation bypasses proactive gating',
    async () => {
      await mount();
      await click('打开评审设置');
      await click('安静模式');
      await click('关闭评审设置');
      await settle();
      await generate('她说还要二十分钟');
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /先歇一会儿/,
      );
      assert.equal(card(), undefined);
      await generate('做一个雨夜回家的场景');
      assert.ok(card());
    },
  );
  await t.test(
    'delayed actions keep their sequence and a later direct control cancels the remaining timeline',
    async () => {
      await mount();
      await click('场景应用');
      await click('试用示例 先清爽，再安静');
      await settle();
      assert.match(card().textContent!, /延时/);
      await click('保存');
      await settle();
      await click('打开场景 ' + stored()[0].result.scene.name);
      await settle();
      await click('好');
      await act(async () => {
        await new Promise((r) => setTimeout(r, 3400));
      });
      assert.match(
        visible('[data-testid="vehicle-state"]')[0].textContent!,
        /净化.*开启/,
      );
      assert.match(
        visible('[data-testid="vehicle-state"]')[0].textContent!,
        /音量.*30%/,
        'the delayed volume must not be in the initial preview',
      );
      await click('主动服务弹窗');
      await type('描述你想要的场景', '温度26度');
      await click('发送给小塔');
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5200));
      });
      assert.match(
        visible('[data-testid="vehicle-state"]')[0].textContent!,
        /26℃/,
      );
      assert.equal(
        JSON.parse(localStorage.getItem('scene-studio.ideas.v1') || '[]')
          .length,
        0,
        'cancelled timeline cannot enqueue an applied idea',
      );
    },
  );
  await t.test(
    'compact proposal keeps speech outside and removes teaching copy without hiding actions',
    async () => {
      await mount();
      await click('体验 还要等一会儿');
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1200));
      });
      assert.ok(button('好'));
      const popup = visible('[data-testid="service-popup"]')[0];
      assert.equal(popup.querySelector('[data-testid="voice-feedback"]'), null);
      if (!card()) await click('查看方案');
      assert.ok(button('好'));
      assert.equal(card().querySelector('[class*="overflow-y-auto"]'), null);
      assert.match(card().textContent!, /温度.*24℃/);
      assert.doesNotMatch(
        card().textContent!,
        /交互演示|建议，你说了算|先试|自动保存|她说还要|先歇一会儿/,
      );
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /先歇一会儿/,
      );
      assert.equal(stored().length, 0);
    },
  );
  await t.test(
    'inline preference editing persists, changes recommendations and stays isolated by profile',
    async () => {
      await mount();
      await click('场景应用');
      await click('它学会了什么');
      await click('切换档案 周');
      await select('偏好值 温度', '25℃');
      assert.match(
        visible('[aria-label="偏好影响预览"]')[0].textContent!,
        /25℃/,
      );
      await click('切换档案 林');
      assert.equal(button('偏好值 温度').textContent, '24℃');
      await mount(false);
      await click('场景应用');
      await click('它学会了什么');
      await click('切换档案 周');
      assert.equal(button('偏好值 温度').textContent, '25℃');
      if (!card()) await click('查看方案');
      await settle();
      await click('保存');
      await settle();
      assert.equal(
        stored()[0].result.scene.actions.find(
          (a: any) => a.primary === '主驾温度控制',
        ).secondary,
        '25℃',
      );
      await click('它学会了什么');
      await select('偏好值 温度', '26℃');
      assert.equal(
        stored()[0].result.scene.actions.find(
          (a: any) => a.primary === '主驾温度控制',
        ).secondary,
        '25℃',
      );
    },
  );
  await t.test(
    'preference creation, cancel, deletion and restoration are real persistent operations',
    async () => {
      await mount();
      await click('场景应用');
      await click('它学会了什么');
      await click('添加偏好');
      await select('编辑偏好值', '25℃');
      await click('保存偏好');
      assert.equal(visible('[data-testid="memory-row"]').length, 1);
      await click('编辑偏好 温度');
      await select('编辑偏好值', '20℃');
      await click('关闭偏好编辑');
      assert.equal(button('偏好值 温度').textContent, '25℃');
      await click('添加偏好');
      await select('偏好项目', '主驾座椅通风');
      await select('编辑偏好值', '2挡');
      await click('保存偏好');
      await click('删除偏好 温度');
      assert.equal(visible('button[aria-label="偏好值 温度"]').length, 0);
      await mount(false);
      await click('场景应用');
      await click('它学会了什么');
      await act(async () =>
        visible('[aria-label="偏好管理"] details summary')[0].click(),
      );
      await click('恢复偏好 温度');
      assert.equal(button('偏好值 温度').textContent, '25℃');
      assert.equal(visible('[data-testid="memory-row"]').length, 2);
      if (!card()) await click('查看方案');
      await settle();
      assert.match(card().textContent!, /通风.*2挡/);
    },
  );
  await t.test(
    'suggestions have usable templates and manual creation can build a scene from empty',
    async () => {
      await mount();
      await click('场景应用');
      await click('场景建议');
      assert.ok(button('查看模板 等你的片刻'));
      await click('查看模板 等你的片刻');
      await settle();
      await click('编辑');
      await type('场景名称', '周末等候');
      await select('设置主驾温度控制', '25℃');
      await click('保存');
      await settle();
      assert.equal(stored()[0].result.scene.name, '周末等候');
      await click('新建场景');
      await click('手动创建');
      await type('场景名称', '午后阅读');
      await select('添加动作', '主驾温度控制');
      await select('设置主驾温度控制', '23℃');
      await click('保存');
      await settle();
      assert.equal(stored().length, 2);
      assert.deepEqual(
        stored().find((s: any) => s.result.scene.name === '午后阅读').result
          .scene.actions,
        [{ primary: '主驾温度控制', secondary: '23℃' }],
      );
    },
  );
  await t.test(
    'v19 proposal is immediately actionable, rejectable and reversible without a countdown',
    async () => {
      await mount();
      await click('体验 还要等一会儿');
      assert.ok(card());
      assert.ok(button('好'));
      assert.ok(button('不要'));
      assert.ok(button('编辑'));
      assert.equal(
        visible('[data-testid="service-popup"] button').some((b) =>
          b.textContent?.includes('查看方案'),
        ),
        false,
      );
      await click('不要');
      assert.equal(card(), undefined);
      assert.equal(stored().length, 0);
      await click('体验 还要等一会儿');
      await click('好');
      assert.match(
        visible('[data-testid="application-state"]')[0].textContent!,
        /已应用/,
      );
      assert.ok(button('撤销'));
      assert.ok(button('保存'));
      assert.doesNotMatch(
        visible('[data-testid="application-state"]')[0].textContent!,
        /正在调整|倒计时/,
      );
      await click('撤销');
      assert.ok(card());
      assert.equal(stored().length, 0);
    },
  );
  await t.test(
    'v19 examples separate host modes and chat from proposed scenes',
    async () => {
      await mount();
      await click('直接车控');
      for (
        let i = 0;
        i < 3 && !visible('button[aria-label="体验 进入录音模式"]').length;
        i++
      )
        await click('下一组示例');
      await click('体验 进入录音模式');
      assert.equal(card(), undefined);
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /已进入录音模式/,
      );
      await click('清除对话');
      await click('直接车控');
      for (
        let i = 0;
        i < 3 && !visible('button[aria-label="体验 进入露营模式"]').length;
        i++
      )
        await click('下一组示例');
      await click('体验 进入露营模式');
      assert.equal(card(), undefined);
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /已进入露营模式/,
      );
      await click('清除对话');
      assert.equal(
        visible('button').some((b) => b.textContent?.trim() === '普通对话'),
        false,
      );
      await generate('又堵了，烦死了');
      assert.equal(card(), undefined);
      assert.equal(stored().length, 0);
    },
  );
  await t.test(
    'v19 live replies preserve vehicle context, scene confirmation, direct controls and clarification',
    async () => {
      const oldFetch = globalThis.fetch;
      const requests: GenerateInput[] = [];
      globalThis.fetch = async (url, options) => {
        if (typeof url === 'string' && url.endsWith('/api/models'))
          return Response.json({
            configured: true,
            models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' }],
            defaultModel: 'deepseek-v4-flash',
          });
        assert.equal(typeof options?.body, 'string');
        const b: GenerateInput = JSON.parse(options!.body as string);
        requests.push(b);
        const scene = {
          ...emptyScene(),
          understanding: '已理解你的要求',
          name: '安静',
          intent: 'action',
          actions: [
            { primary: '氛围灯亮度', secondary: '20%' },
            { primary: '主驾温度控制', secondary: '22℃' },
          ],
        };
        if (b.input === '打开那个') {
          scene.intent = 'clarify';
          scene.actions = [];
          scene.clarify = '请问要打开什么？';
        } else if (b.input.includes('补充：'))
          scene.actions = [{ primary: '氛围灯开关', secondary: '开启' }];
        else if (b.input === '把空调温度调到22度')
          scene.actions = [{ primary: '主驾温度控制', secondary: '22℃' }];
        return new Response(
          'data: ' +
            JSON.stringify({
              type: 'result',
              result: validateScene(scene, b.context, b.input),
              model: 'deepseek-v4-flash',
              provenance: PROMPT_INFO,
              timing: {
                ttft: 0.1,
                understanding: 0.2,
                total: 0.3,
                attempts: 1,
              },
            }) +
            '\n\n',
        );
      };
      try {
        await mount();
        await click('打开评审设置');
        await click('真实 AI');
        await click('关闭评审设置');
        await settle();
        await generate('创建一个灯光和温度的场景');
        assert.ok(card());
        assert.ok(button('好'));
        assert.equal(requests[0].context.vehicle?.['主驾温度控制'], '24℃');
        assert.equal(
          visible('[data-testid="application-state"]').length,
          0,
          'proposal does not apply because model labeled it action',
        );
        await click('不要');
        await generate('把空调温度调到22度');
        assert.equal(card(), undefined);
        assert.match(
          visible('[data-testid="voice-feedback"]')[0].textContent!,
          /22℃/,
        );
        await generate('打开那个');
        assert.equal(card(), undefined);
        assert.match(
          visible('[data-testid="voice-feedback"]')[0].textContent!,
          /请问要打开什么/,
        );
        await generate('灯光');
        assert.equal(card(), undefined);
        assert.match(requests.at(-1)!.input, /打开那个\n补充：灯光/);
        assert.equal(requests.at(-1)!.context.vehicle?.['主驾温度控制'], '22℃');
        assert.match(
          visible('[data-testid="voice-feedback"]')[0].textContent!,
          /开启/,
        );
        assert.equal(stored().length, 0);
      } finally {
        globalThis.fetch = oldFetch;
      }
    },
  );
  await t.test(
    'v20 featured emotion, anniversary and English examples open relevant proposals',
    async () => {
      await mount();
      assert.equal(
        visible('[aria-label="主动服务示例"] button[aria-pressed]').length,
        2,
      );
      for (const title of ['心情不好', '今天是纪念日', 'Time to unwind']) {
        assert.ok(button('体验 ' + title));
      }
      await generate('今天心情很不好');
      assert.match(card().textContent!, /缓一缓/);
      await click('不要');
      await click('体验 今天是纪念日');
      assert.ok(card());
      assert.match(card().textContent!, /浪漫/);
      assert.match(card().textContent!, /提议中/);
      assert.ok(button('好'));
      assert.ok(button('不要'));
      assert.equal(stored().length, 0);
      await click('不要');
      await click('体验 心情不好');
      assert.match(card().textContent!, /缓一缓/);
      assert.equal(stored().length, 0);
      await click('不要');
      await click('体验 Time to unwind');
      assert.match(card().textContent!, /Unwind/);
      assert.match(
        visible('[data-testid="voice-feedback"]')[0].textContent!,
        /Take a moment/,
      );
      assert.equal(stored().length, 0);
    },
  );
  await t.test(
    'v20 popup save and save-as keep the current surface until the user opens the app',
    async () => {
      await mount();
      await click('体验 心情不好');
      await click('好');
      await click('保存');
      assert.equal(button('主动服务弹窗').getAttribute('aria-pressed'), 'true');
      assert.equal(stored().length, 1);
      await click('清除对话');
      await click('体验 心情不好');
      await click('好');
      await click('保存');
      assert.ok(visible('[data-testid="duplicate-panel"]')[0]);
      await click('另存');
      assert.equal(button('主动服务弹窗').getAttribute('aria-pressed'), 'true');
      assert.equal(stored().length, 2);
      await click('场景应用');
      await settle();
      assert.equal(button('场景应用').getAttribute('aria-pressed'), 'true');
      assert.equal(visible('button[aria-label="打开场景 缓一缓"]').length, 2);
    },
  );
  await act(async () => root.unmount());
  dom.window.close();
});
