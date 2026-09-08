import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.DEMO_URL || 'http://localhost:3005';
const out = process.env.TEST_ARTIFACTS || 'test-results/nonvoice';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [],
  checks = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on('pageerror', (e) => errors.push(e.message));
  const button = (name) => page.getByRole('button', { name, exact: true });
  const proposal = () => page.getByTestId('nonvoice-proposal');
  const stored = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('scene-studio.saved.v1') || '[]'),
    );
  async function fresh() {
    await page.goto(base);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  }
  async function story(id) {
    await button('体验故事').last().click();
    await page.getByTestId('story-' + id).click();
  }
  async function measure(label) {
    const layout = await proposal().evaluate((el) => {
      const body = el.children[1],
        rect = el.getBoundingClientRect();
      return {
        height: rect.height,
        width: rect.width,
        scroll: body.scrollHeight - body.clientHeight,
        x: rect.x,
        y: rect.y,
        bottom: rect.bottom,
        right: rect.right,
      };
    });
    checks.push({ label, ...layout });
    assert.ok(
      layout.scroll <= 2,
      label + ' normal proposal requires scrolling: ' + layout.scroll,
    );
    assert.ok(
      layout.x >= 0 &&
        layout.y >= 0 &&
        layout.right <= page.viewportSize().width &&
        layout.bottom <= page.viewportSize().height,
      label + ' on screen',
    );
  }
  await fresh();
  for (const [w, h] of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    for (const front of [false, true]) {
      await fresh();
      if (front) await button('正视阅读').click();
      await button('体验故事').last().click();
      await page.waitForTimeout(550);
      await page.screenshot({
        path: `${out}/stories-${w}-${front ? 'front' : 'tilt'}.png`,
      });
      await page.getByTestId('story-after-movement').click();
      await page.getByTestId('observation-invitation').click();
      await page.waitForTimeout(300);
      await measure(`${w} ${front ? 'front' : 'tilt'}`);
      await page.screenshot({
        path: `${out}/phases-${w}-${front ? 'front' : 'tilt'}.png`,
      });
      assert.equal(await button('好').count(), 1);
      assert.equal(await button('不要').count(), 1);
      assert.equal(await button('编辑').count(), 1);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await fresh();
  await story('together');
  // A cancelled long press (scroll/drag gesture) must not open the save menu.
  const row = button('主驾温度控制 22℃');
  const box = await row.boundingBox();
  await page.mouse.move(box.x + 60, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 70);
  await page.waitForTimeout(1050);
  await page.mouse.up();
  assert.equal(await button('记住现在这样').count(), 1);
  // Real one-second press exposes the menu; controls themselves remain clickable.
  await page.mouse.move(box.x + 60, box.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(1100);
  await page.mouse.up();
  assert.equal(await button('记住现在这样').count(), 2);
  await button('记住现在这样').first().click();
  await page.getByRole('textbox', { name: '新场景名称' }).fill('我们两个人');
  await page.getByRole('checkbox', { name: '保存主驾座椅通风' }).uncheck();
  await page.screenshot({ path: `${out}/family-capture.png` });
  await button('保存').click();
  assert.equal((await stored()).length, 1);
  assert.equal((await stored())[0].result.scene.actions.length, 4);
  assert.equal(
    await button('主动服务弹窗').getAttribute('aria-pressed'),
    'true',
  );
  await measure('family saved');
  await page.reload();
  await button('场景应用').click();
  await button('打开场景 我们两个人').click();
  await button('现在使用').click();
  await button('撤销').click();
  await button('返回地图').click();
  await fresh();
  await story('breeze');
  await button('记住现在这样').click();
  await button('不要').click();
  assert.equal((await stored()).length, 0);
  await fresh();
  await button('体验故事').last().click();
  await button('晨间暖舱').click();
  await page.getByTestId('observation-invitation').click();
  await page.getByRole('checkbox', { name: '下次满足条件时自动使用' }).check();
  await button('好').click();
  await button('下一次出行').click();
  assert.ok((await stored())[0].origin.lastTriggeredAt);
  await button('撤销').click();
  await button('场景应用').click();
  assert.equal(await page.getByTestId('nonvoice-layer').count(), 0);
  await button('它学会了什么').click();
  await page.screenshot({ path: `${out}/learned.png` });
  assert.equal(errors.length, 0, errors.join('\n'));
  await writeFile(
    `${out}/checks.json`,
    JSON.stringify(
      {
        base,
        checks,
        errors,
        longPress: true,
        capture: true,
        refresh: true,
        automatic: true,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      checks: checks.length,
      errors,
      longPress: 'passed',
      capture: 'passed',
      refresh: 'passed',
      automatic: 'passed',
      artifacts: out,
    }),
  );
} finally {
  await browser.close();
}
