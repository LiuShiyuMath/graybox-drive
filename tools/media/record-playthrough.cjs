'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const required = name => {
  assert(process.env[name], `${name} is required`);
  return process.env[name];
};
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const viewport = { width: 1280, height: 720 };
const mode = required('RECORD_MODE');
assert(['rehearse', 'record'].includes(mode), 'RECORD_MODE must be rehearse or record');
const url = new URL(required('DRIVE_URL'));
assert(!url.username && !url.password, 'DRIVE_URL must not contain credentials');
url.searchParams.set('map', 'circuit');
const base = new URL('.', url);
const source = JSON.parse(fs.readFileSync(required('SOURCE_MANIFEST'), 'utf8'));
assert(['production', 'local-rehearsal'].includes(source.environment), 'Declare the actual source environment');
assert(/^[0-9a-f]{40}$/.test(source.commit), 'A full source commit is required');
assert.equal(new URL('.', source.deployment_url).href, base.href, 'Manifest and runtime URL must match');
if (source.environment === 'production') {
  assert.equal(url.protocol, 'https:', 'Production capture requires HTTPS');
  assert(/^https:\/\//.test(source.deployment_evidence_url || ''), 'Production deployment evidence is required');
} else {
  assert(mode === 'rehearse' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Local sources are rehearsal only');
}
const assets = Object.fromEntries(Object.entries(source.sourceSha256 || {}).filter(([name]) => name.startsWith('dist/')));
for (const [name, hash] of Object.entries(assets)) {
  assert(/^dist\/[a-zA-Z0-9_.-]+$/.test(name) && !name.includes('..'), `Invalid runtime asset name: ${name}`);
  assert(/^[0-9a-f]{64}$/.test(hash), `Invalid SHA-256 for ${name}`);
}
const core = ['index.html', 'game.js', 'art.js', 'perspective.js', 'presentation.js', 'dusk-sky.webp'];
for (const name of core) assert(assets['dist/' + name], `Missing runtime hash: ${name}`);
if (mode === 'record') {
  const rehearsal = JSON.parse(fs.readFileSync(required('REHEARSAL_REPORT'), 'utf8'));
  assert(rehearsal.passed && rehearsal.mode === 'rehearse', 'A successful rehearsal is required');
  assert.equal(rehearsal.commit, source.commit, 'Rehearsal source commit differs');
  assert.equal(rehearsal.sourceEnvironment, source.environment, 'Rehearsal must use the production source');
  assert.deepEqual(rehearsal.sourceSha256, assets, 'Rehearsal assets differ');
  assert.deepEqual(rehearsal.viewport, viewport, 'Rehearsal framing differs');
}

const out = path.resolve(required('MEDIA_OUT'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.mkdirSync(out);
fs.mkdirSync(path.join(out, 'raw'));
fs.mkdirSync(path.join(out, 'frames'));
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const options = { headless: true, args: process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [] };
if (process.env.DRIVE_CHROMIUM_PATH) options.executablePath = process.env.DRIVE_CHROMIUM_PATH;

(async () => {
  const assetChecks = [], runtimeAssets = [], pendingResponses = [], errors = [], samples = [], markers = [], pictures = [], keys = new Set(), laps = [];
  let browser, context, page, video, failure, result, clockStart;
  const elapsed = () => Number(process.hrtime.bigint() - clockStart) / 1e6;
  const mark = (label, state = {}) => {
    const row = { elapsed_ms: elapsed(), label, ...state };
    markers.push(row);
    fs.appendFileSync(path.join(out, 'markers.jsonl'), JSON.stringify(row) + '\n');
    return row;
  };
  const key = async (name, down) => {
    if (down && !keys.has(name)) { await page.keyboard.down(name); keys.add(name); }
    else if (!down && keys.has(name)) { await page.keyboard.up(name); keys.delete(name); }
  };
  const capture = async name => {
    const file = 'frames/' + name + '.png';
    await page.screenshot({ path: path.join(out, file) });
    pictures.push(file);
  };
  const observe = () => page.evaluate(() => {
    const n = nearest(car.x, car.y);
    let remaining = 55, index = n.index;
    while (remaining > 0) {
      const a = track[index], b = track[(index + 1) % N];
      remaining -= Math.hypot(b.x - a.x, b.y - a.y);
      index = (index + 1) % N;
    }
    const target = track[index];
    let error = Math.atan2(target.y - car.y, target.x - car.x) - car.angle;
    while (error > Math.PI) error -= TAU;
    while (error < -Math.PI) error += TAU;
    return { game: gameSnapshot(), presentation: presentationSnapshot(), controller: { error, distance: Math.hypot(target.x - car.x, target.y - car.y), surfaceDistance: n.distance } };
  });
  try {
    for (const [name, expected] of Object.entries(assets)) {
      const assetUrl = new URL(name.slice(5), base);
      const response = await fetch(assetUrl, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
      assert(response.ok, `${name} returned HTTP ${response.status}`);
      assert.equal(new URL(response.url).origin, base.origin, 'Asset redirected to another origin');
      const bytes = Buffer.from(await response.arrayBuffer()), actual = sha256(bytes);
      assetChecks.push({ path: name, url: assetUrl.href, expectedSha256: expected, actualSha256: actual, bytes: bytes.length });
      assert.equal(actual, expected, `Published bytes differ for ${name}`);
    }
    write('source.json', { ...source, sourceSha256: assets, verifiedAt: new Date().toISOString(), assetChecks });
    browser = await chromium.launch(options);
    context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...(mode === 'record' ? { recordVideo: { dir: path.join(out, 'raw'), size: viewport } } : {}) });
    clockStart = process.hrtime.bigint();
    const wallOrigin = new Date().toISOString();
    page = await context.newPage();
    video = page.video();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      const responseUrl = new URL(response.url());
      if (responseUrl.origin !== base.origin || !responseUrl.pathname.startsWith(base.pathname)) return;
      const relative = responseUrl.pathname.slice(base.pathname.length) || 'index.html';
      const name = 'dist/' + relative;
      if (!assets[name]) {
        if (['document', 'script', 'stylesheet', 'image'].includes(response.request().resourceType())) errors.push(`Missing source hash for browser resource ${name}`);
        return;
      }
      pendingResponses.push(response.body().then(bytes => {
        const actual = sha256(bytes);
        runtimeAssets.push({ path: name, url: response.url(), sha256: actual, bytes: bytes.length });
        if (actual !== assets[name]) errors.push(`Browser-loaded bytes differ for ${name}`);
      }).catch(error => errors.push(`Cannot hash ${name}: ${error.message}`)));
    });
    await page.goto(url.href, { waitUntil: 'networkidle' });
    await Promise.all(pendingResponses);
    for (const name of core) assert(runtimeAssets.some(asset => asset.path === 'dist/' + name), `Browser did not load ${name}`);
    assert.deepEqual(errors, []);
    const discovery = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('#start, .map-picker button')].map(el => {
        const rect = el.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return { label: el.textContent.trim(), id: el.id || el.dataset.map, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, inside: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight, reachable: hit === el || el.contains(hit) };
      });
      return { title: document.title, viewport: { width: innerWidth, height: innerHeight }, controls, initial: gameSnapshot(), scroll: { x: scrollX, y: scrollY } };
    });
    assert(discovery.controls.length >= 6 && discovery.controls.every(control => control.inside && control.reachable), 'Initial controls must be visible and reachable');
    assert.equal(discovery.initial.state, 'ready');
    assert((await page.locator('#start').innerText()).includes('开始驾驶'));
    write('discovery.json', discovery);
    mark('开始驾驶入口', { state: discovery.initial.state });
    await capture('01-menu');
    await page.waitForTimeout(1200);
    const startBox = await page.locator('#start').boundingBox();
    assert(startBox, 'Start button is missing');
    await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2, { steps: 12 });
    await page.waitForTimeout(350);
    await page.mouse.click(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
    await page.locator('[data-view=chase]').click();
    await page.mouse.move(8, 8, { steps: 8 });
    assert.equal(await page.evaluate(() => gameSnapshot().state), 'running');
    assert.equal(await page.locator('[data-view=chase]').getAttribute('aria-pressed'), 'true');
    const started = mark('车后追尾 起跑');
    await capture('02-start');
    let integral = 0, lastLap = 0, contactCaptured = false, steeringSign = 0;
    while (elapsed() - started.elapsed_ms < 100000) {
      const sample = await observe(), g = sample.game;
      if (g.lap !== lastLap) {
        lastLap = g.lap;
        laps.push(g.lap);
        mark(`第 ${g.lap} 圈`, { raceSeconds: g.elapsed, rank: g.racers.playerRank });
        await capture('lap-' + g.lap);
      }
      if (g.racers.playerContacts > 0 && !contactCaptured) {
        mark('实际车辆接触', { raceSeconds: g.elapsed, contacts: g.racers.playerContacts });
        await capture('03-contact');
        contactCaptured = true;
      }
      if (!samples.length || g.elapsed - samples.at(-1).game.elapsed >= .25 || g.state === 'finished') samples.push({ elapsed_ms: elapsed(), ...sample });
      if (g.state === 'finished') break;
      assert.equal(g.state, 'running');
      assert.equal(g.hazard.fall, 0, 'Driver must remain on the circuit');
      const desired = Math.max(-1, Math.min(1, 2 * Math.sin(sample.controller.error) * 155 * (1 + Math.abs(g.speed) / 650) / Math.max(20, sample.controller.distance)));
      const sign = Math.sign(desired);
      if (sign !== steeringSign) { integral = 0; steeringSign = sign; }
      integral += Math.abs(desired);
      const steering = integral >= 1;
      if (steering) integral -= 1;
      await key('a', steering && desired < 0);
      await key('d', steering && desired > 0);
      const target = g.elapsed < 4 ? 220 : 122;
      await key('w', g.speed < target);
      await key('Space', g.speed > target + 18);
      await page.waitForTimeout(32);
    }
    for (const name of [...keys]) await key(name, false);
    const final = await page.evaluate(() => ({ game: gameSnapshot(), presentation: presentationSnapshot(), best: Number(localStorage.getItem(activeMap.bestKey)) }));
    assert.equal(final.game.state, 'finished', 'Natural three-lap finish required');
    assert.deepEqual(laps, [1, 2, 3]);
    assert(final.game.elapsed >= 60 && final.game.elapsed <= 90, 'Race must take 60 to 90 actual simulation seconds');
    assert(final.game.racers.playerContacts > 0 && final.presentation.events.impact > 0, 'Actual physical AI contact and feedback required');
    assert.equal(final.presentation.events.finish, 1);
    assert(final.best > 0 && final.best <= final.game.elapsed, 'Actual best time must be saved');
    assert(samples.some(sample => sample.game.racers.actors.some(actor => actor.progress > 240)), 'Other cars must actually race');
    const finished = mark('自然完赛 成绩已保存', { raceSeconds: final.game.elapsed, savedBest: final.best });
    await capture('04-finish');
    await page.waitForTimeout(4500);
    assert.deepEqual(await page.evaluate(() => gameSnapshot()), final.game, 'Finish must freeze gameplay and standings');
    assert(await page.locator('#overlay').isVisible(), 'Finish results must remain visible');
    const held = mark('完赛结果保持可读');
    assert(held.elapsed_ms - finished.elapsed_ms >= 4500);
    await capture('05-finish-held');
    await Promise.all(pendingResponses);
    assert.deepEqual(errors, []);
    result = { passed: true, mode, status: mode === 'record' ? 'recorded-needs-visual-review' : 'rehearsed', commit: source.commit, sourceEnvironment: source.environment, sourceSha256: assets, source: url.href, viewport, browser: browser.version(), playwright: require('playwright/package.json').version, wallOrigin, timingReference: 'Monotonic wall time immediately before page creation; align markers to decoded video frames before editing.', raceSeconds: final.game.elapsed, raceWallSeconds: (finished.elapsed_ms - started.elapsed_ms) / 1000, resultHoldSeconds: (held.elapsed_ms - finished.elapsed_ms) / 1000, proofWallIntervalSeconds: [finished.elapsed_ms / 1000, held.elapsed_ms / 1000], laps, contacts: final.game.racers.playerContacts, final, runtimeAssets, pictures, audio: 'No audio captured. Web Audio is left at the fresh-profile default off.', driver: 'Normal keyboard input with read-only route observations. Native animation; no teleports, finish calls or clock overrides.', gates: { semantics: true, selectors: true, state_transitions: true, framing: true, dependencies: true }, visualReview: 'pending', physicalPhone: false };
  } catch (error) {
    failure = error;
    result = { passed: false, mode, status: 'blocked', commit: source.commit, sourceEnvironment: source.environment, sourceSha256: assets, error: error.message, runtimeAssets, assetChecks, errors };
    if (page) { try { await capture('failure'); } catch {} }
  } finally {
    if (page) for (const name of [...keys]) { try { await key(name, false); } catch {} }
    if (context) await context.close();
    if (video) {
      const raw = await video.path(), bytes = fs.readFileSync(raw);
      assert(bytes.length > 0, 'The full raw recording must not be empty');
      fs.chmodSync(raw, 0o444);
      result.recording = { path: path.relative(out, raw), sha256: sha256(bytes), bytes: bytes.length, immutableRaw: true };
    }
    write('samples.json', samples);
    write('result.json', result);
    if (browser) await browser.close();
  }
  if (failure) throw failure;
  console.log(`PASS ${mode}: ${result.raceSeconds.toFixed(2)} s, three laps, ${result.contacts} contacts, result hold ${result.resultHoldSeconds.toFixed(2)} s`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
