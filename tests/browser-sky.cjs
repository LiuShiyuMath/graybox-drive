const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
assert(process.env.DRIVE_URL, 'Run through tests/verify.py or set DRIVE_URL to a same-origin HTTP server');
const url = new URL(process.env.DRIVE_URL);
url.searchParams.set('map', 'circuit');
const out = path.resolve(process.env.DRIVE_VERIFY_DIR || 'verification/latest', 'sky');
fs.mkdirSync(out, { recursive: true });
const options = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] };
if (process.env.DRIVE_CHROMIUM_PATH) options.executablePath = process.env.DRIVE_CHROMIUM_PATH;

(async () => {
  const browser = await chromium.launch(options), checks = [], errors = [];
  let failure;
  async function frame(viewport, missing, backend) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    await context.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    if (backend === 'software') await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return String(type).includes('webgl') ? null : getContext.call(this, type, ...args);
      };
    });
    if (missing) await context.route('**/dusk-sky.webp', route => route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url.href);
    await page.waitForLoadState('networkidle');
    await page.click('#start');
    await page.click('[data-view=chase]');
    await page.evaluate(() => draw());
    const name = `${viewport.width}-${backend}-${missing ? 'fallback' : 'clouds'}.png`;
    await page.screenshot({ path: path.join(out, name) });
    const sample = await page.evaluate(() => {
      const before = gameSnapshot();
      DriveArt.backdrop(perspectivePose());
      const pixels = Array.from(ctx.getImageData(0, 0, w, Math.floor(h * .35)).data);
      const after = gameSnapshot();
      draw();
      return { pixels, before, after };
    });
    await context.close();
    assert.deepEqual(sample.before, sample.after, 'Drawing the sky must not change gameplay');
    return { ...sample, name };
  }
  try {
    for (const { viewport, backend } of [
      { viewport: { width: 1280, height: 720 }, backend: 'webgl' },
      { viewport: { width: 844, height: 390 }, backend: 'webgl' },
      { viewport: { width: 390, height: 844 }, backend: 'webgl' },
      { viewport: { width: 844, height: 390 }, backend: 'software' }
    ]) {
      const loaded = await frame(viewport, false, backend), missing = await frame(viewport, true, backend);
      assert.deepEqual(loaded.before, missing.before, 'Sky availability must not change the starting race');
      assert.equal(loaded.pixels.length, missing.pixels.length);
      let different = 0, error = 0;
      for (let i = 0; i < loaded.pixels.length; i += 4) {
        const delta = Math.abs(loaded.pixels[i] - missing.pixels[i]) + Math.abs(loaded.pixels[i + 1] - missing.pixels[i + 1]) + Math.abs(loaded.pixels[i + 2] - missing.pixels[i + 2]);
        if (delta > 12) different++;
        error += delta;
      }
      const ratio = different / (loaded.pixels.length / 4);
      const row = { viewport, backend, differentPixelRatio: ratio, meanChannelDifference: error / (loaded.pixels.length / 4 * 3), pictures: [loaded.name, missing.name] };
      checks.push(row);
      assert(ratio > .1, `The concept clouds must be visible, not merely downloaded: ${JSON.stringify(row)}`);
      console.log('PASS visible concept clouds and unchanged race at', viewport.width, 'difference ratio', ratio.toFixed(3));
    }
    assert.deepEqual(errors, []);
  } catch (error) {
    failure = error;
  } finally {
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed: !failure, source: url.href, browser: browser.version(), checks, errors, error: failure?.message, scope: 'Real Chromium scene captures plus backdrop pixels with the real cloud asset present and deliberately missing. Frozen scene inputs; independent normal-animation race remains required.' }, null, 2) + '\n');
    await browser.close();
  }
  if (failure) throw failure;
})().catch(error => { console.error(error); process.exitCode = 1; });
