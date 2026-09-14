// Browser verification only; this temporary loopback static server is not part of the app.
// Requires an existing Playwright installation on Node's module path.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { cases, uiCaseIds } = require('./cases.cjs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results');
fs.mkdirSync(output, { recursive: true });
const assets = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/calculators.js': ['calculators.js', 'text/javascript'], '/app.js': ['app.js', 'text/javascript'] };
const server = http.createServer((request, response) => {
  const asset = assets[request.url];
  if (!asset || request.method !== 'GET') { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': asset[1] + '; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(fs.readFileSync(path.join(root, asset[0])));
});

async function enter(page, id, value, { allowInvalidInjection = false } = {}) {
  const control = page.locator(`[id="${id}"]`);
  const type = await control.evaluate(element => element.tagName === 'SELECT' ? 'select' : element.type);
  if (type === 'select') {
    const exists = await control.locator('option').evaluateAll((options, value) => options.some(option => option.value === value), String(value));
    if (!exists) {
      assert.ok(allowInvalidInjection, `Missing application option for ${id}: ${value}`);
      // Only deliberately invalid fixture fields may bypass the normal options.
      await control.evaluate((element, value) => element.add(new Option(value, value)), String(value));
    }
    await control.selectOption(String(value));
  } else {
    if (type === 'date' && value === '2025-02-29') {
      assert.ok(allowInvalidInjection, 'Impossible dates may be injected only for invalid-input fixtures.');
      await control.evaluate(element => { element.type = 'text'; });
    }
    await control.fill(String(value));
  }
}
async function prepare(page, fixture) {
  const fixtureEnter = (id, value) => enter(page, id, value, { allowInvalidInjection: fixture.expected.error === id });
  await page.locator(`[data-calculator="${fixture.kind}"]`).click();
  await page.locator('#clear').click();
  if (fixture.input.unit) await fixtureEnter('unit', fixture.input.unit);
  if (fixture.kind === 'doubling') {
    while (await page.locator('.measurement').count() < fixture.input.measurements.length) await page.locator('#add-measurement').click();
    for (const [index, row] of fixture.input.measurements.entries()) { await fixtureEnter(`date-${index}`, row.date); await fixtureEnter(`psa-${index}`, row.psa); }
  } else {
    for (const [id, value] of Object.entries(fixture.input)) if (id !== 'unit') await fixtureEnter(id, value);
  }
}
async function resultValues(page) { return page.locator('#result .result-value').allTextContents(); }
async function calculate(page) { await page.getByRole('button', { name: 'Calculate', exact: true }).click(); }
async function emptyForm(page) {
  assert.equal(await page.locator('#result').isHidden(), true);
  const values = await page.locator('main input, main select:not(#unit)').evaluateAll(elements => elements.map(element => element.value));
  assert.ok(values.every(value => value === ''), 'form should be empty');
}
async function inspectLayout(page, width, channel) {
  await page.setViewportSize({ width, height: 900 });
  for (const kind of ['density', 'doubling', 'volume', 'ipss', 'egfr']) {
    await prepare(page, cases.find(fixture => fixture.kind === kind && !fixture.expected.error));
    await calculate(page);
    const layout = await page.evaluate(() => {
      const visible = element => element.getClientRects().length > 0;
      const controls = [...document.querySelectorAll('button,input,select')].filter(visible);
      return {
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        shortControls: controls.filter(element => element.getBoundingClientRect().height < 44).map(element => element.id || element.textContent),
        smallInputs: controls.filter(element => element.matches('input,select') && parseFloat(getComputedStyle(element).fontSize) < 16).length,
        unlabeled: controls.filter(element => element.matches('input,select') && element.labels.length === 0).length,
        outside: controls.filter(element => element.getBoundingClientRect().left < 0 || element.getBoundingClientRect().right > innerWidth + 1).length
      };
    });
    assert.ok(layout.scrollWidth <= width, `${channel}/${kind}/${width}: overflow`);
    assert.deepEqual(layout.shortControls, []);
    assert.equal(layout.smallInputs, 0); assert.equal(layout.unlabeled, 0); assert.equal(layout.outside, 0);
    if (channel === 'chrome' && [320, 375, 1440].includes(width)) {
      await page.screenshot({ path: path.join(output, `${channel}-${kind}-${width}.png`), fullPage: true });
    }
  }
}

async function run(channel, base) {
  const browser = await chromium.launch({ channel, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Taipei' });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  await page.clock.setFixedTime(new Date('2026-09-14T04:00:00Z'));
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push({ url: request.url(), method: request.method(), data: request.postData() }));
  await context.addInitScript(() => {
    window.__storageWrites = 0;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) { window.__storageWrites++; return original.apply(this, args); };
  });
  const report = { channel, version: browser.version(), fixtureVariants: 0, interactionCases: [], reviewChecks: [], layouts: [], errors: [] };
  try {
    await page.goto(base);
    await emptyForm(page);
    assert.equal(await page.locator('[aria-pressed="true"]').textContent(), 'PSA Density');
    const initialRequestCount = requests.length;
    for (const fixture of cases) {
      await prepare(page, fixture);
      assert.equal(await page.locator('#result').isHidden(), true);
      await calculate(page);
      if (fixture.expected.error) {
        assert.equal(await page.locator('#result').isHidden(), true, fixture.id);
        assert.equal(await page.locator(`#error-${fixture.expected.error}`).isVisible(), true, fixture.id);
        assert.equal(await page.locator(':focus').getAttribute('aria-invalid'), 'true', fixture.id);
      } else {
        assert.deepEqual(await resultValues(page), fixture.expected, fixture.id);
        assert.equal(await page.locator('#result').isVisible(), true, fixture.id);
        if (fixture.kind === 'ipss') assert.deepEqual(await page.locator('.result-label').allTextContents(), ['IPSS symptom score: ', 'Symptom severity: ', 'QoL score: ']);
      }
      report.fixtureVariants++;
    }
    assert.equal(requests.length, initialRequestCount, 'calculating or editing must not request any resources');
    console.log(`${channel}: ${report.fixtureVariants} synthetic fixture variants PASS`);

    // PV-08: a unit change clears the measurements, without relabeling old values.
    await prepare(page, cases.find(item => item.id === 'PV-01')); await calculate(page);
    await enter(page, 'unit', 'mm'); await emptyForm(page);
    assert.equal(await page.locator('#unit').inputValue(), 'mm');
    assert.deepEqual(await page.locator('[data-unit-for]').allTextContents(), ['mm', 'mm', 'mm']);
    report.interactionCases.push('PV-08');

    // IP-12/13/14: QoL edits/removal do not change the symptom score; resets clear everything.
    await prepare(page, cases.find(item => item.id === 'IP-05')); await calculate(page);
    await enter(page, 'qol', '6'); assert.equal(await page.locator('#result').isHidden(), true); await calculate(page);
    assert.deepEqual(await resultValues(page), ['20 / 35', 'Severe', '6 / 6']); report.interactionCases.push('IP-12');
    await enter(page, 'qol', ''); assert.equal(await page.locator('#result').isHidden(), true); await calculate(page);
    assert.deepEqual(await resultValues(page), ['20 / 35', 'Severe', 'Not answered']); report.interactionCases.push('IP-13');
    await prepare(page, cases.find(item => item.id === 'IP-06')); await calculate(page);
    await page.locator('#clear').click(); await emptyForm(page);
    await prepare(page, cases.find(item => item.id === 'IP-06')); await calculate(page);
    await page.locator('[data-calculator="density"]').click(); await page.locator('[data-calculator="ipss"]').click(); await emptyForm(page);
    report.interactionCases.push('IP-14');
    assert.deepEqual(report.interactionCases, uiCaseIds);

    // Every calculator: edit -> stale result removed; Clear and switching restore defaults.
    for (const kind of ['density', 'doubling', 'volume', 'ipss', 'egfr']) {
      const fixture = cases.find(item => item.kind === kind && !item.expected.error);
      await prepare(page, fixture); await calculate(page);
      const control = page.locator('main input, main select:not(#unit)').first();
      await control.focus();
      if (await control.evaluate(element => element.tagName === 'SELECT')) await control.selectOption('1'); else await control.fill('');
      assert.equal(await page.locator('#result').isHidden(), true);
      assert.equal(await page.locator('#edit-notice').textContent(), 'Inputs changed. Calculate again.');
      await page.locator('#clear').click(); await emptyForm(page);
      assert.equal(await page.locator('#edit-notice').isHidden(), true);
      if (kind === 'doubling') { assert.equal(await page.locator('.measurement').count(), 2); assert.equal(await page.locator('.remove:disabled').count(), 2); }
      if (kind === 'volume') assert.equal(await page.locator('#unit').inputValue(), 'cm');
      if (kind === 'egfr') assert.equal(await page.locator('#unit').inputValue(), 'mg/dL');
      await prepare(page, fixture); await calculate(page);
      await page.locator(`[data-calculator="${kind === 'density' ? 'egfr' : 'density'}"]`).click();
      await page.locator(`[data-calculator="${kind}"]`).click(); await emptyForm(page);
    }

    // Units in eGFR clear only creatinine; row mutations retain date/value associations.
    await prepare(page, cases.find(item => item.id === 'EG-01')); await calculate(page);
    await enter(page, 'unit', 'µmol/L');
    assert.equal(await page.locator('#age').inputValue(), '60'); assert.equal(await page.locator('#sex').inputValue(), 'male');
    assert.equal(await page.locator('#creatinine').inputValue(), ''); assert.equal(await page.locator('#result').isHidden(), true);
    await prepare(page, cases.find(item => item.id === 'DT-02')); await calculate(page);
    await page.locator('.remove').nth(1).click(); assert.equal(await page.locator('#result').isHidden(), true);
    assert.deepEqual(await page.locator('.measurement input').evaluateAll(elements => elements.map(element => element.value)), ['2025-01-01', '2', '2025-07-20', '8']);
    await calculate(page); assert.deepEqual(await resultValues(page), ['3.29 months']);
    await page.locator('#add-measurement').click(); assert.equal(await page.locator('#result').isHidden(), true);

    // Invalid inputs, field-blur correction, keyboard submission, and focus styling.
    await prepare(page, cases.find(item => item.id === 'PD-06')); await calculate(page);
    assert.equal(await page.locator(':focus').getAttribute('id'), 'volume');
    await enter(page, 'volume', '40'); await page.locator('#volume').press('Tab');
    assert.equal(await page.locator('#error-volume').isHidden(), true);
    assert.equal(await page.locator('#result').isHidden(), true);
    await page.locator('#volume').focus(); await page.locator('#volume').press('Enter');
    assert.deepEqual(await resultValues(page), ['0.150 ng/mL/cc']);
    await page.locator('#psa').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'volume');
    assert.ok(await page.locator(':focus').evaluate(element => getComputedStyle(element).outlineStyle !== 'none'));
    for (const value of ['4abc', '<0.1', '1,5', '1e3', 'NaN', 'Infinity', '9'.repeat(400), '0.' + '0'.repeat(400) + '1']) {
      await enter(page, 'psa', value); await calculate(page); assert.equal(await page.locator('#result').isHidden(), true); assert.equal(await page.locator('#error-psa').isVisible(), true);
    }

    // Regression: clearing after correcting an error must not lose the pointer
    // click when a blur message would otherwise move the button.
    await prepare(page, cases.find(item => item.id === 'PD-06')); await calculate(page);
    await enter(page, 'volume', '40'); await page.locator('#clear').click(); await emptyForm(page);

    // M1: unit blur must not reveal an unrelated required field cleared by the
    // unit change. Calculate must still validate the complete form.
    await prepare(page, cases.find(item => item.id === 'EG-09')); await calculate(page);
    await page.locator('#unit').focus(); await enter(page, 'unit', 'µmol/L');
    await page.locator('#unit').press('Tab');
    assert.equal(await page.locator('#error-creatinine').isHidden(), true);
    assert.equal(await page.locator('#error-age').isVisible(), true);
    await calculate(page); assert.equal(await page.locator('#error-creatinine').isVisible(), true);
    report.reviewChecks.push('M1: only the blurred scalar control is revalidated');

    // M1: new untouched rows stay error-free on blur; old and new duplicate
    // partners update together without revealing that new row's missing PSA.
    await prepare(page, cases.find(item => item.id === 'DT-08')); await calculate(page);
    await page.locator('#add-measurement').click();
    // A date input can use Tab for its internal date segments, so explicitly
    // focus a button without clicking it to exercise a real focusout event
    // while leaving every unrelated input untouched.
    await enter(page, 'date-2', '2025-06-01'); await page.locator('#add-measurement').focus();
    assert.equal(await page.locator('#error-psa-2').isHidden(), true);
    assert.equal(await page.locator('#error-date-0').isVisible(), true);
    assert.equal(await page.locator('#error-date-1').isVisible(), true);
    await enter(page, 'date-0', '2025-02-01'); await page.locator('#add-measurement').focus();
    assert.equal(await page.locator('#error-date-0').isHidden(), true);
    assert.equal(await page.locator('#error-date-1').isHidden(), true);
    await enter(page, 'date-0', '2025-01-01'); await page.locator('#add-measurement').focus();
    assert.equal(await page.locator('#error-date-0').isVisible(), true);
    assert.equal(await page.locator('#error-date-1').isVisible(), true);
    assert.equal(await page.locator('#error-psa-2').isHidden(), true);
    await calculate(page); assert.equal(await page.locator('#error-psa-2').isVisible(), true);
    report.reviewChecks.push('M1: untouched rows and related duplicate-date errors');

    // M2: the legal µmol/L option exists, works, and cannot be manufactured by
    // the success-path helper if an application regression removes it.
    const micromolar = cases.find(item => item.id === 'EG-03');
    await prepare(page, micromolar);
    assert.equal(await page.locator('#unit option[value="µmol/L"]').count(), 1);
    await calculate(page); assert.deepEqual(await resultValues(page), micromolar.expected);
    await page.locator('#unit option[value="µmol/L"]').evaluate(element => element.remove());
    await assert.rejects(() => enter(page, 'unit', 'µmol/L'), /Missing application option for unit/);
    assert.equal(await page.locator('#unit option[value="µmol/L"]').count(), 0);
    report.reviewChecks.push('M2: success fixtures require existing application options');

    await prepare(page, cases.find(item => item.id === 'IP-05'));
    await assert.rejects(() => enter(page, 'qol', '7'), /Missing application option for qol/);
    assert.equal(await page.locator('#qol option[value="7"]').count(), 0);
    await prepare(page, cases.find(item => item.id === 'IP-11' && item.input.qol === '7'));
    assert.equal(await page.locator('#qol option[value="7"]').count(), 1);
    await calculate(page); assert.equal(await page.locator('#error-qol').isVisible(), true);
    report.reviewChecks.push('M2: injection is explicit and limited to the invalid fixture field');

    // Refresh, BFCache-style pageshow, and an actual away/back navigation.
    await prepare(page, cases.find(item => item.id === 'PD-01')); await calculate(page);
    await page.reload(); await emptyForm(page);
    await prepare(page, cases.find(item => item.id === 'PD-01')); await calculate(page);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await emptyForm(page);
    await prepare(page, cases.find(item => item.id === 'PD-01')); await calculate(page);
    await page.goto('about:blank'); await page.goBack(); await emptyForm(page);

    for (const width of [320, 375, 768, 1440]) { await inspectLayout(page, width, channel); report.layouts.push(width); }

    // Approximate 200% zoom reflow using a 720 CSS-pixel viewport.
    await inspectLayout(page, 720, channel); report.layouts.push(720);

    const beforeOffline = requests.length;
    await context.setOffline(true);
    for (const kind of ['density', 'doubling', 'volume', 'ipss', 'egfr']) {
      const fixture = cases.find(item => item.kind === kind && !item.expected.error);
      await prepare(page, fixture); await calculate(page); assert.deepEqual(await resultValues(page), fixture.expected);
    }
    assert.equal(requests.length, beforeOffline, 'offline calculations must not attempt network access');
    const storage = await page.evaluate(async () => ({
      local: localStorage.length, session: sessionStorage.length, cookie: document.cookie,
      databases: (await indexedDB.databases()).length, caches: (await caches.keys()).length,
      workers: (await navigator.serviceWorker.getRegistrations()).length, writes: window.__storageWrites,
      query: location.search, hash: location.hash, historyState: history.state
    }));
    assert.deepEqual(storage, { local: 0, session: 0, cookie: '', databases: 0, caches: 0, workers: 0, writes: 0, query: '', hash: '', historyState: null });
    for (const request of requests) { assert.equal(request.method, 'GET'); assert.equal(request.data, null); assert.ok(request.url.startsWith(base)); assert.ok(assets[new URL(request.url).pathname]); }
    assert.deepEqual(errors, []);
    report.privacy = { requests: requests.length, inputOrResultRequests: 0, storage };
    report.offline = 'all five calculators passed';
    report.additionalChecks = 'defaults; all-calculator edits, Clear and switching; row mutations; eGFR unit change; keyboard; error correction; refresh and back navigation; no network/storage';

    await context.setOffline(false);
    const filePage = await context.newPage();
    await filePage.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await prepare(filePage, cases.find(item => item.id === 'PD-01')); await calculate(filePage);
    assert.deepEqual(await resultValues(filePage), ['0.150 ng/mL/cc']); report.fileProtocol = 'PASS';
    await filePage.close();

    const timezone = await browser.newContext({ timezoneId: 'America/New_York' });
    const zonePage = await timezone.newPage(); await zonePage.goto(base);
    await prepare(zonePage, cases.find(item => item.id === 'DT-07')); await calculate(zonePage);
    assert.deepEqual(await resultValues(zonePage), ['0.07 months']);
    await timezone.close(); report.timezones = ['Asia/Taipei', 'America/New_York'];
    report.status = 'PASS';
    console.log(`${channel}: interaction, layout, privacy, offline, file:// and timezone checks PASS`);
    return report;
  } catch (error) {
    await page.screenshot({ path: path.join(output, `${channel}-failure.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const reports = [];
  try {
    for (const channel of process.argv.slice(2).length ? process.argv.slice(2) : ['chrome', 'msedge']) reports.push(await run(channel, base));
    fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify({ status: 'PASS', reports }, null, 2));
    console.log(`PASS: ${reports.length} browser(s); all 55 SPEC IDs covered; ${reports.reduce((sum, report) => sum + report.fixtureVariants, 0)} fixture executions plus interaction checks.`);
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
