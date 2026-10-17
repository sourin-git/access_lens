import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import * as THREE from 'three';

const artifacts = resolve('.scene-test-artifacts/app');
await mkdir(artifacts, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5176', '--strictPort'], { stdio: 'pipe' });
let serverOutput = '';
server.stdout.on('data', data => { serverOutput += data; });
server.stderr.on('data', data => { serverOutput += data; });
process.on('exit', () => server.kill());
const baseURL = 'http://127.0.0.1:5176';
for (let attempt = 0; ; attempt++) {
  try { if ((await fetch(baseURL)).ok) break; } catch { /* preview is starting */ }
  if (attempt === 50 || server.exitCode !== null) throw new Error(`Preview did not start: ${serverOutput}`);
  await new Promise(resolve => setTimeout(resolve, 100));
}
const workspace = process.cwd();
let browser;
try {
  process.chdir(artifacts);
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
} finally { process.chdir(workspace); }
const errors = [];
const results = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'no-preference' });
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.addInitScript(() => {
  const request = window.requestAnimationFrame.bind(window);
  const cancel = window.cancelAnimationFrame.bind(window);
  const timeout = window.setTimeout.bind(window);
  const clear = window.clearTimeout.bind(window);
  window.__appActivity = { frames: new Set(), scanTimers: new Set() };
  window.requestAnimationFrame = callback => {
    const id = request(time => { window.__appActivity.frames.delete(id); callback(time); });
    window.__appActivity.frames.add(id);
    return id;
  };
  window.cancelAnimationFrame = id => { window.__appActivity.frames.delete(id); cancel(id); };
  window.setTimeout = (callback, delay, ...args) => {
    const id = timeout(() => { window.__appActivity.scanTimers.delete(id); callback(...args); }, delay);
    if (delay === 100) window.__appActivity.scanTimers.add(id);
    return id;
  };
  window.clearTimeout = id => { window.__appActivity.scanTimers.delete(id); clear(id); };
});
async function check(label, run) { await run(); results.push(label); console.log(`PASS ${label}`); }
const reportButton = id => page.locator(`[data-element-id="${id}"]`);
async function waitReady(target = page) { await target.waitForFunction(() => !document.querySelector('#scan-button').disabled); }

try {
  await page.goto(baseURL);
  await waitReady();
  await check('production main app and independent harness both served', async () => {
    assert.match(await page.title(), /AccessLens/);
    assert.equal(await page.locator('.report-item').count(), 5);
    assert.equal(await page.locator('#scan-status-heading').textContent(), 'Ready to explore');
    assert.equal(await page.locator('[data-access-lens-fallback]').count(), 0);
    assert.equal((await page.request.get(`${baseURL}/scene-test.html`)).status(), 200);
    assert.match(await page.locator('.report-disclaimer').textContent(), /No real website/);
  });
  await page.screenshot({ path: resolve(artifacts, 'desktop-idle.png'), fullPage: true });
  await check('scan start, completion, illustrative severities and suggestions', async () => {
    await page.click('#scan-button');
    assert.equal(await page.locator('#scan-button').isDisabled(), true);
    assert.equal(await page.locator('#scan-status-card').getAttribute('data-phase'), 'scanning');
    await page.waitForFunction(() => document.querySelector('#scan-status-card').dataset.phase === 'completed');
    assert.equal(await page.locator('.severity-badge.high:visible').count(), 2);
    assert.equal(await page.locator('.severity-badge.moderate:visible').count(), 1);
    assert.equal(await page.locator('.severity-badge.note:visible').count(), 2);
    await reportButton('body-text').click();
    assert.match(await page.locator('#detail-description').textContent(), /Example finding/);
    assert.match(await page.locator('#detail-suggestion').textContent(), /contrast/);
    await page.screenshot({ path: resolve(artifacts, 'desktop-complete.png'), fullPage: true });
  });
  await check('all profile, contrast, text-scale and motion controls work', async () => {
    for (const profile of ['default', 'low-vision', 'dyslexia', 'motor', 'reduced-motion']) {
      await page.selectOption('#profile-select', profile);
      assert.equal(await page.locator('#app').getAttribute('data-profile'), profile);
      assert.equal(await page.locator('#scan-status-card').getAttribute('data-phase'), 'completed');
    }
    await page.check('#contrast-toggle');
    assert.equal(await page.locator('#app').getAttribute('data-contrast'), 'true');
    await page.locator('#text-scale').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#text-scale-value').textContent(), '110%');
    assert.ok(Math.abs(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)) - 17.6) < .1);
    await page.check('#motion-toggle');
    await page.evaluate(() => {
      const capture = () => {
        const canvas = document.querySelector('#access-lens-canvas');
        const gl = canvas.getContext('webgl2');
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let hash = 2166136261;
        for (const value of pixels) hash = Math.imul(hash ^ value, 16777619);
        window.__sceneSnapshot = { hash, width: canvas.width, height: canvas.height, error: gl.getError() };
      };
      // Run after the app's handler, in the same event task as its synchronous
      // reduced-motion render, before the drawing buffer may be discarded.
      document.querySelector('#profile-select').addEventListener('change', capture);
      document.addEventListener('click', capture);
      document.addEventListener('pointerup', capture);
    });
    await page.selectOption('#profile-select', 'motor');
    assert.match(await page.locator('#motion-note').textContent(), /override/);
    assert.equal(await page.locator('#app').getAttribute('data-motion'), 'reduced');
    assert.equal(await page.evaluate(() => window.__appActivity.frames.size), 0);
    const first = await page.evaluate(() => window.__sceneSnapshot);
    await page.selectOption('#profile-select', 'dyslexia');
    const second = await page.evaluate(() => window.__sceneSnapshot);
    assert.deepEqual(first, second, 'The app motion override must preserve the reduced-motion scene pixels');
    await page.click('#reset-preferences');
    assert.equal(await page.locator('#profile-select').inputValue(), 'default');
    assert.equal(await page.locator('#text-scale-value').textContent(), '100%');
    assert.equal(await page.locator('#contrast-toggle').isChecked(), false);
    assert.equal(await page.locator('#motion-toggle').isChecked(), false);
  });
  await check('bidirectional scene/report selection and clearing for all five IDs', async () => {
    await page.selectOption('#profile-select', 'reduced-motion');
    await page.locator('#access-lens-canvas').scrollIntoViewIfNeeded();
    const rect = await page.locator('#access-lens-canvas').boundingBox();
    const camera = new THREE.PerspectiveCamera(38, rect.width / rect.height, .1, 60);
    camera.position.z = Math.max(9.4, Math.max(2.8, 5.2 / camera.aspect) / Math.tan(THREE.MathUtils.degToRad(19)) * 1.08);
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    for (const [id, x, y] of [['navigation', 0, 1.82], ['hero', -1.18, .72], ['body-text', -1.18, -.65], ['hero-image', 1.94, .04], ['primary-button', -1.92, -1.6]]) {
      await page.locator('#access-lens-canvas').scrollIntoViewIfNeeded();
      const box = await page.locator('#access-lens-canvas').boundingBox();
      const projected = new THREE.Vector3(x, y, .045).applyEuler(new THREE.Euler(-.045, -.11, 0)).project(camera);
      await page.mouse.click(box.x + (projected.x + 1) * box.width / 2, box.y + (1 - projected.y) * box.height / 2);
      assert.equal(await reportButton(id).getAttribute('aria-pressed'), 'true');
      const selected = await page.evaluate(() => window.__sceneSnapshot);
      await page.click('#clear-selection');
      assert.equal(await reportButton(id).getAttribute('aria-pressed'), 'false');
      const cleared = await page.evaluate(() => window.__sceneSnapshot);
      assert.notDeepEqual(selected, cleared, 'Selection clearing must change the scene highlight');
      await reportButton(id).click();
      const selectedAgain = await page.evaluate(() => window.__sceneSnapshot);
      assert.deepEqual(selected, selectedAgain, `Report selection should restore the same ${id} highlight`);
    }
  });
  await check('native keyboard controls, report activation and visible focus', async () => {
    await page.locator('.skip-link').focus();
    assert.equal(await page.locator('.skip-link').evaluate(element => getComputedStyle(element).clipPath), 'none');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
    await page.locator('#profile-select').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#profile-select').inputValue(), 'low-vision');
    await reportButton('hero-image').focus();
    await page.keyboard.press('Enter');
    assert.equal(await reportButton('hero-image').getAttribute('aria-pressed'), 'true');
    assert.equal(await reportButton('hero-image').evaluate(element => getComputedStyle(element).outlineStyle), 'solid');
    await page.locator('#clear-selection').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('.report-item[aria-pressed="true"]').count(), 0);
  });
  await check('scan reset cancels completion and allows a fresh scan', async () => {
    await page.click('#scan-button');
    await page.click('#reset-demo');
    await page.waitForTimeout(4200);
    assert.equal(await page.locator('#scan-status-card').getAttribute('data-phase'), 'idle');
    assert.equal(await page.locator('.severity-badge:visible').count(), 0);
    await page.click('#scan-button');
    await page.waitForFunction(() => document.querySelector('#scan-status-card').dataset.phase === 'completed');
  });
  await check('OS reduced motion survives every profile and app override switching', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const profile of ['default', 'low-vision', 'dyslexia', 'motor', 'reduced-motion']) {
      await page.selectOption('#profile-select', profile);
      assert.equal(await page.evaluate(() => window.__appActivity.frames.size), 0);
      assert.equal(await page.locator('#app').getAttribute('data-motion'), 'reduced');
    }
    await page.check('#motion-toggle'); await page.uncheck('#motion-toggle');
    assert.equal(await page.evaluate(() => window.__appActivity.frames.size), 0);
    await page.click('#reset-preferences');
    assert.match(await page.locator('#motion-note').textContent(), /system preference/);
    assert.equal(await page.evaluate(() => window.__appActivity.frames.size), 0);
  });
  await check('mobile layout and 150 percent text do not overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#text-scale').fill('150');
    assert.equal(await page.locator('#text-scale-value').textContent(), '150%');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await reportButton('primary-button').click();
    assert.match(await page.locator('#selected-name').textContent(), /Primary button/);
    assert.ok((await reportButton('primary-button').boundingBox()).height >= 44);
    await page.screenshot({ path: resolve(artifacts, 'mobile-large-text.png'), fullPage: true });
    await page.click('#reset-preferences');
    await page.screenshot({ path: resolve(artifacts, 'mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 320, height: 720 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
  await check('teardown stops scan timers, frames and UI listeners; BFCache remount works', async () => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.click('#scan-button');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    assert.equal(await page.evaluate(() => window.__appActivity.scanTimers.size), 0);
    assert.equal(await page.evaluate(() => window.__appActivity.frames.size), 0);
    await page.waitForTimeout(4200);
    assert.equal(await page.locator('#scan-status-card').getAttribute('data-phase'), 'scanning');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await waitReady();
    assert.equal(await page.locator('#scan-status-card').getAttribute('data-phase'), 'idle');
  });
  await check('WebGL failure keeps reports, demo scans and keyboard selection functional', async () => {
    const alternative = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    alternative.on('pageerror', error => errors.push(String(error)));
    await alternative.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl2' ? null : getContext.call(this, type, ...args); };
    });
    await alternative.goto(baseURL); await waitReady(alternative);
    assert.equal(await alternative.locator('[data-access-lens-fallback]').count(), 1);
    await alternative.locator('[data-access-lens-fallback]').getByRole('button', { name: 'Hero image', exact: true }).focus();
    await alternative.keyboard.press('Enter');
    assert.equal(await alternative.locator('[data-element-id="hero-image"]').getAttribute('aria-pressed'), 'true');
    await alternative.click('#scan-button');
    await alternative.waitForFunction(() => document.querySelector('#scan-status-card').dataset.phase === 'completed');
    await alternative.screenshot({ path: resolve(artifacts, 'mobile-fallback.png'), fullPage: true });
    await alternative.close();
  });
  await check('scene module download failure preserves the report and demo scan', async () => {
    const unavailable = await browser.newPage({ viewport: { width: 900, height: 1000 } });
    unavailable.on('pageerror', error => errors.push(String(error)));
    await unavailable.route('**/assets/createScene-*.js', route => route.abort('failed'));
    await unavailable.goto(baseURL);
    await unavailable.waitForFunction(() => document.querySelector('#viewport-mode').textContent === 'PREVIEW UNAVAILABLE');
    await waitReady(unavailable);
    await unavailable.locator('[data-element-id="body-text"]').click();
    assert.match(await unavailable.locator('#selected-name').textContent(), /Body text/);
    await unavailable.click('#scan-button');
    await unavailable.waitForFunction(() => document.querySelector('#scan-status-card').dataset.phase === 'completed');
    assert.equal(await unavailable.locator('.severity-badge.high:visible').count(), 2);
    assert.equal(await unavailable.locator('#retry-scene').isVisible(), true);
    await unavailable.close();
  });
  assert.deepEqual(errors, []);
  await writeFile(resolve(artifacts, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  console.log(`ALL ${results.length} APP CHECKS PASSED`);
} finally { await browser.close(); server.kill(); }
