// Called by browser.test.cjs in an isolated context for each installed browser.
const assert = require('node:assert/strict');
const { expect } = require('playwright/test');
const storageKey = 'urology-toolbox-theme';
const opposite = theme => theme === 'dark' ? 'light' : 'dark';

async function appearance(page, theme) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  const label = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  await expect(page.locator('#theme-toggle')).toHaveText(label);
  await expect(page.getByRole('button', { name: `Switch to ${label}`, exact: true })).toBeVisible();
  assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).colorScheme), theme);
  assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor), theme === 'dark' ? 'rgb(16, 26, 32)' : 'rgb(255, 255, 255)');
}

async function calculateDensity(page) {
  await page.locator('#psa').fill('6');
  await page.locator('#volume').fill('40');
  await page.getByRole('button', { name: 'Calculate', exact: true }).click();
  await expect(page.locator('.result-value')).toHaveText('0.150 ng/mL/cc');
}

async function stored(page) {
  return page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
}

// Check rendered colors, including transparent elements on their actual surface.
async function contrast(page, selector, property = 'color', minimum = 4.5) {
  const pairs = await page.locator(selector).evaluateAll((elements, property) => {
    function background(element) {
      for (let node = element; node; node = node.parentElement) {
        const value = getComputedStyle(node).backgroundColor;
        if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return value;
      }
      return 'rgb(255, 255, 255)';
    }
    return elements.filter(element => element.getClientRects().length && !element.disabled).map(element => ({
      foreground: getComputedStyle(element)[property], background: background(element), label: element.id || element.className || element.tagName
    }));
  }, property);
  assert.ok(pairs.length, `No visible elements for contrast check: ${selector}`);
  function luminance(color) {
    const values = color.match(/[\d.]+/g).slice(0, 3).map(value => {
      const channel = Number(value) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  }
  const ratios = pairs.map(pair => {
    const a = luminance(pair.foreground), b = luminance(pair.background);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(ratio >= minimum, `${pair.label} ${property}: ${ratio.toFixed(2)}:1 (required ${minimum}:1)`);
    return ratio;
  });
  return Math.min(...ratios);
}

module.exports = async function verifyTheme(browser, base) {
  const report = { systemDefaults: [], manualAndReload: [], contrast: [], resilience: [] };
  for (const system of ['light', 'dark']) {
    const context = await browser.newContext({ colorScheme: system });
    const errors = [], requests = [];
    context.on('page', page => {
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push(request.url()));
    });
    await context.addInitScript(() => {
      window.__themeWrites = [];
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        window.__themeWrites.push([key, value]);
        return original.call(this, key, value);
      };
    });
    try {
      const page = await context.newPage();
      await page.goto(base);
      await appearance(page, system);
      assert.deepEqual(await stored(page), {});
      assert.deepEqual(await page.evaluate(() => window.__themeWrites), []);
      // A first visit keeps following OS changes until the first manual choice.
      await page.emulateMedia({ colorScheme: opposite(system) });
      await appearance(page, opposite(system));
      await page.emulateMedia({ colorScheme: system });
      await appearance(page, system);
      assert.deepEqual(await stored(page), {});
      report.systemDefaults.push(system);

      await calculateDensity(page);
      const textRatio = await contrast(page, 'h1, .brand-mark, .version, .privacy, .navigation button, .navigation-note, h2, .eyebrow, .purpose, label, .unit, input, .hint, .primary, .secondary, .result-label, .result-value, .method, .method h3, .formula, a, footer');
      await contrast(page, 'input, .secondary', 'borderTopColor', 3);
      await page.locator('#theme-toggle').focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(page.locator('#theme-toggle')).toBeFocused();
      assert.equal(await page.locator('#theme-toggle').evaluate(element => getComputedStyle(element).outlineStyle), 'solid');
      await contrast(page, '#theme-toggle', 'outlineColor', 3);
      const beforeSwitch = requests.length;
      await page.locator('#theme-toggle').press('Space');
      const selected = opposite(system);
      await appearance(page, selected);
      await expect(page.locator('.result-value')).toHaveText('0.150 ng/mL/cc');
      assert.equal(await page.locator('#psa').inputValue(), '6');
      assert.equal(await page.locator('#volume').inputValue(), '40');
      assert.deepEqual(await stored(page), { [storageKey]: selected });
      assert.deepEqual(await page.evaluate(() => window.__themeWrites), [[storageKey, selected]]);
      assert.equal(requests.length, beforeSwitch, 'Theme switching must not make network requests');
      await page.emulateMedia({ colorScheme: selected });
      await page.emulateMedia({ colorScheme: system });
      await appearance(page, selected);
      await page.reload();
      await appearance(page, selected);
      assert.equal(await page.locator('#psa').inputValue(), '');
      assert.equal(await page.locator('#result').isHidden(), true);
      assert.deepEqual(await page.evaluate(() => window.__themeWrites), []);
      const reopened = await context.newPage();
      await reopened.goto(base);
      await appearance(reopened, selected);
      await reopened.close();
      // Click also switches back, preserving only the latest appearance choice.
      await page.locator('#theme-toggle').click();
      await appearance(page, system);
      await calculateDensity(page);
      await page.locator('#volume').fill('0');
      await page.getByRole('button', { name: 'Calculate', exact: true }).click();
      await expect(page.locator('#error-volume')).toBeVisible();
      const errorRatio = await contrast(page, '#error-volume');
      await page.locator('#theme-toggle').click();
      await expect(page.locator('#error-volume')).toBeVisible();
      assert.equal(await page.locator('#volume').inputValue(), '0');
      await page.locator('#clear').click();
      await page.locator('[data-calculator="egfr"]').click();
      await appearance(page, selected);
      assert.deepEqual(await stored(page), { [storageKey]: selected });
      assert.equal(await page.evaluate(() => sessionStorage.length), 0);
      assert.equal(await page.evaluate(() => document.cookie), '');
      assert.deepEqual(await page.evaluate(() => window.__themeWrites), [[storageKey, system], [storageKey, selected]]);
      report.manualAndReload.push(system);
      report.contrast.push({ theme: system, minimumText: +textRatio.toFixed(2), errorText: +errorRatio.toFixed(2), controlAndFocusMinimum: 3 });
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }

  // An invalid stored value must never become an arbitrary theme/HTML value.
  const invalid = await browser.newContext({ colorScheme: 'dark', storageState: { cookies: [], origins: [{ origin: new URL(base).origin, localStorage: [{ name: storageKey, value: 'invalid-theme' }] }] } });
  try {
    const page = await invalid.newPage();
    await page.goto(base); await appearance(page, 'dark');
    await page.locator('#theme-toggle').click(); await appearance(page, 'light');
    assert.deepEqual(await stored(page), { [storageKey]: 'light' });
    report.resilience.push('invalid stored preference falls back to system');
  } finally { await invalid.close(); }

  for (const failure of ['read', 'write']) {
    const context = await browser.newContext({ colorScheme: 'dark' });
    try {
      await context.addInitScript(failure => {
        if (failure === 'read') Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
        else Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); };
      }, failure);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base); await appearance(page, 'dark');
      await page.locator('#theme-toggle').click(); await appearance(page, 'light');
      await calculateDensity(page);
      await page.reload(); await appearance(page, 'dark');
      assert.deepEqual(errors, []);
      report.resilience.push(`storage ${failure} failure leaves switching/calculation working`);
    } finally { await context.close(); }
  }
  return report;
};
