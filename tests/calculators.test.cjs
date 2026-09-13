const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { calculate, decimal, calendarDay, format } = require('../calculators.js');
const { cases, today, uiCaseIds } = require('./cases.cjs');

for (const [index, fixture] of cases.entries()) test(`${fixture.id} variant ${index + 1}`, () => {
  const outcome = calculate(fixture.kind, fixture.input, today);
  if (fixture.expected.error) {
    assert.equal(outcome.ok, false);
    assert.ok(outcome.errors[fixture.expected.error]);
    assert.equal(outcome.lines, undefined);
  } else {
    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.lines.map(line => line.value), fixture.expected);
    for (const key of ['value', 'days']) if (fixture.raw?.[key] !== undefined) assert.ok(Math.abs(outcome.raw[key] - fixture.raw[key]) <= fixture.raw.tolerance);
    if (fixture.id === 'DT-01') assert.ok(outcome.notes.some(note => note.startsWith('Two-point')));
    if (fixture.id === 'DT-02') assert.ok(!outcome.notes.some(note => note.startsWith('Two-point')));
    if (['IP-01', 'IP-10'].includes(fixture.id)) assert.ok(outcome.notes.includes('No symptoms reported.'));
  }
});
test('Every SPEC fixture ID is covered by calculation or browser interaction tests', () => {
  const spec = fs.readFileSync(path.join(__dirname, '..', 'SPEC.md'), 'utf8');
  const ids = [...spec.matchAll(/^\| ((?:PD|DT|PV|IP|EG)-\d+) \|/gm)].map(match => match[1]);
  assert.equal(ids.length, 55);
  assert.deepEqual(new Set([...cases.map(fixture => fixture.id), ...uiCaseIds]), new Set(ids));
});
test('Strict parser: whole input, decimals, blanks, overflow and underflow', () => {
  for (const invalid of ['', ' ', '4abc', '<0.1', '1,5', '2 ng/mL', '1e3', 'NaN', 'Infinity', '∞', '0x10', '9'.repeat(400), '0.' + '0'.repeat(400) + '1']) assert.ok(decimal(invalid).error, invalid);
  assert.equal(decimal('  .5  ').value, 0.5);
  assert.equal(decimal('0').value, 0);
  assert.equal(decimal('60.0').value, 60);
});
test('Calendar dates: leap years, year 1, DST-independent day arithmetic', () => {
  assert.equal(calendarDay('2025-02-29'), null);
  assert.equal(calendarDay('0000-01-01'), null);
  assert.equal(calendarDay('2025-13-01'), null);
  assert.equal(calendarDay('2025-04-31'), null);
  assert.notEqual(calendarDay('0001-01-01'), null);
  assert.equal(calendarDay('2024-03-01') - calendarDay('2024-02-28'), 2);
  assert.equal(calendarDay('2025-03-10') - calendarDay('2025-03-08'), 2);
});
test('Finite-result checks reject extreme inputs without misleading zero', () => {
  const huge = '1' + '0'.repeat(308);
  const tiny = '0.' + '0'.repeat(307) + '1';
  const invalids = [
    ['density', { psa: huge, volume: tiny }],
    ['density', { psa: tiny, volume: huge }],
    ['volume', { width: huge, height: huge, length: huge, unit: 'cm' }],
    ['volume', { width: tiny, height: tiny, length: tiny, unit: 'cm' }],
    ['egfr', { age: '100000000', sex: 'male', creatinine: '1', unit: 'mg/dL' }],
    ['egfr', { age: '60', sex: 'male', creatinine: huge, unit: 'mg/dL' }]
  ];
  for (const [kind, input] of invalids) { const outcome = calculate(kind, input); assert.equal(outcome.ok, false); assert.ok(outcome.errors._form); }
});
test('Display rounding and small positive results', () => {
  assert.equal(format(1.005, 2), '1.01');
  assert.equal(format(2.675, 2), '2.68');
  assert.equal(format(0.0001, 3), '<0.001');
  assert.equal(format(0.0009, 3), '<0.001');
  assert.equal(format(0.001, 3), '0.001');
  assert.equal(format(0, 3), '0.000');
  assert.equal(format(0.001, 2), '<0.01');
  assert.equal(format(0.01, 1), '<0.1');
  assert.deepEqual(calculate('density', { psa: '-0', volume: '40' }).lines.map(line => line.value), ['0.000 ng/mL/cc']);
});
test('Integer-only fields reject fractions below binary64 precision', () => {
  assert.equal(calculate('egfr', { age: '60.0000000000000001', sex: 'male', creatinine: '1', unit: 'mg/dL' }).ok, false);
  const fixture = cases.find(item => item.id === 'IP-05');
  assert.equal(calculate('ipss', { ...fixture.input, q1: '2.0000000000000001' }).ok, false);
  assert.equal(calculate('ipss', { ...fixture.input, qol: '3.0000000000000001' }).ok, false);
});
test('Unit conversion preserves raw results', () => {
  assert.equal(calculate('volume', { width: '4', height: '3', length: '5', unit: 'cm' }).raw.value, calculate('volume', { width: '40', height: '30', length: '50', unit: 'mm' }).raw.value);
  assert.equal(calculate('egfr', { age: '60', sex: 'male', creatinine: '1', unit: 'mg/dL' }).raw.value, calculate('egfr', { age: '60', sex: 'male', creatinine: '88.4', unit: 'µmol/L' }).raw.value);
});
test('Unknown units, incomplete series, negative slopes and input isolation', () => {
  assert.equal(calculate('volume', { width: '4', height: '3', length: '5', unit: 'inch' }).ok, false);
  assert.equal(calculate('egfr', { age: '60', sex: 'male', creatinine: '1', unit: 'x' }).ok, false);
  assert.equal(calculate('doubling', { measurements: [] }, today).ok, false);
  const input = structuredClone(cases.find(item => item.id === 'DT-03').input);
  const before = JSON.stringify(input); calculate('doubling', input, today); assert.equal(JSON.stringify(input), before);
});
