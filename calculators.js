/* Pure validation/calculation functions, shared by the browser and Node tests.
   No DOM, network, logging, or storage. Inputs are never retained. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UrologyCalculators = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MONTH_DAYS = 30.4375;
  const SLOPE_EPSILON = 1e-12;
  const NUMERICAL_ERROR = 'Unable to calculate a finite result. Check the values and units.';
  const symptoms = ['Incomplete emptying', 'Frequency', 'Intermittency', 'Urgency', 'Weak stream', 'Straining', 'Nocturia'];
  const flat = 'PSA is effectively unchanged across these measurements; no finite doubling time.';
  const declining = 'PSA is declining across these measurements; doubling time is not applicable.';

  function decimal(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return { error: 'required' };
    if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return { error: 'format' };
    const value = Number(text);
    if (!Number.isFinite(value) || (value === 0 && /[1-9]/.test(text))) return { error: 'range' };
    return { value: value === 0 ? 0 : value };
  }

  // Reject fractional integer-field text even when conversion to binary64
  // would round it to an integer (for example, 2.0000000000000001).
  function whole(raw, value) {
    return Number.isInteger(value) && !/\.\d*[1-9]/.test(String(raw ?? '').trim());
  }

  function localToday(now = new Date()) {
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }

  function calendarDay(raw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw ?? '')) return null;
    const [year, month, day] = raw.split('-').map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(0, 0, 0, 0);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.getTime() / 86400000;
  }

  function positive(value) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(NUMERICAL_ERROR);
    return value;
  }
  function finite(value) {
    if (!Number.isFinite(value)) throw new RangeError(NUMERICAL_ERROR);
    return value;
  }
  function format(value, digits) {
    finite(value);
    if (value < 0) throw new RangeError(NUMERICAL_ERROR);
    const increment = 10 ** -digits;
    if (value > 0 && value < increment) return '<' + increment.toFixed(digits);
    // Intl's decimal half-expand rounding also handles values such as 1.005.
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false }).format(value);
  }

  // A field scope reuses the same validation rules without running formulas.
  // Normal Calculate calls have no scope and still validate every input.
  function evaluate(kind, input = {}, today = localToday(), fields = null) {
    const errors = {};
    const lines = [];
    const notes = [];
    const raw = {};
    const wants = key => fields === null || fields.has(key);
    function number(key, label, { zero = false, integer = false, min = null } = {}) {
      if (!wants(key)) return;
      const parsed = decimal(input[key]);
      if (parsed.error) {
        errors[key] = parsed.error === 'required' ? `Enter ${label}.` : `Enter a finite decimal number for ${label}, without units or comparison signs.`;
      } else if (integer && !whole(input[key], parsed.value)) {
        errors[key] = `Enter ${label} as a whole number.`;
      } else if (min !== null && parsed.value < min) {
        errors[key] = 'This calculator uses the adult CKD-EPI 2021 equation. Enter an age of at least 18 years.';
      } else if (min === null && (zero ? parsed.value < 0 : parsed.value <= 0)) {
        errors[key] = `Enter ${label} ${zero ? 'greater than or equal to' : 'greater than'} 0.`;
      }
      return parsed.value;
    }
    function option(key, choices, message) {
      if (wants(key) && !choices.includes(input[key])) errors[key] = message;
      return input[key];
    }
    function score(key, maximum, message, optional = false) {
      if (!wants(key)) return;
      if (optional && String(input[key] ?? '').trim() === '') return null;
      const parsed = decimal(input[key]);
      if (parsed.error || !whole(input[key], parsed.value) || parsed.value < 0 || parsed.value > maximum) errors[key] = message;
      return parsed.value;
    }
    function result(label, value) { lines.push({ label, value }); }
    const valid = () => Object.keys(errors).length === 0;
    const shouldCalculate = () => fields === null && valid();

    try {
      if (kind === 'density') {
        const psa = number('psa', 'total PSA (ng/mL)', { zero: true });
        const volume = number('volume', 'a prostate volume (mL)');
        if (shouldCalculate()) {
          raw.value = finite(psa / volume);
          if (psa > 0) positive(raw.value);
          result('PSA Density', format(raw.value, 3) + ' ng/mL/cc');
        }
      } else if (kind === 'volume') {
        const unit = option('unit', ['cm', 'mm'], 'Select cm or mm for all dimensions.');
        const dimensions = ['width', 'height', 'length'].map(key => number(key, `${key} (${unit})`));
        if (shouldCalculate()) {
          const [width, height, length] = dimensions.map(value => positive(unit === 'mm' ? value / 10 : value));
          raw.value = positive(positive(positive(0.52 * width) * height) * length);
          result('Estimated Prostate Volume', format(raw.value, 1) + ' mL');
        }
      } else if (kind === 'doubling') {
        const rows = Array.isArray(input.measurements) ? input.measurements : [];
        if (wants('measurements') && rows.length < 2) errors.measurements = 'Enter at least two complete PSA measurements.';
        const todayDay = calendarDay(today);
        if (todayDay === null) throw new RangeError(NUMERICAL_ERROR);
        const seenDates = new Map();
        const checkDates = fields === null || [...fields].some(key => key.startsWith('date-'));
        const values = rows.map((row, index) => {
          const key = row.key ?? index;
          const dateKey = `date-${key}`;
          const psaKey = `psa-${key}`;
          const day = checkDates ? calendarDay(row.date) : null;
          if (wants(dateKey)) {
            if (!row.date) errors[dateKey] = 'Enter a measurement date (YYYY-MM-DD).';
            else if (day === null) errors[dateKey] = 'Enter a valid calendar date (YYYY-MM-DD).';
            else if (day > todayDay) errors[dateKey] = 'Measurement dates cannot be in the future.';
          }
          if (day !== null) {
            if (seenDates.has(day)) {
              if (wants(dateKey)) errors[dateKey] = 'Each PSA measurement must have a different date.';
              if (wants(seenDates.get(day))) errors[seenDates.get(day)] = 'Each PSA measurement must have a different date.';
            }
            seenDates.set(day, dateKey);
          }
          const parsed = wants(psaKey) ? decimal(row.psa) : {};
          if (wants(psaKey) && (parsed.error || parsed.value <= 0)) errors[psaKey] = 'Enter a finite PSA greater than 0 ng/mL, without units or comparison signs.';
          return { day, psa: parsed.value };
        });
        if (shouldCalculate()) {
          values.sort((a, b) => a.day - b.day);
          const times = values.map(row => row.day - values[0].day);
          const logs = values.map(row => finite(Math.log(row.psa)));
          const meanTime = finite(times.reduce((sum, value) => finite(sum + value), 0) / values.length);
          const meanLog = finite(logs.reduce((sum, value) => finite(sum + value), 0) / values.length);
          let numerator = 0;
          let denominator = 0;
          times.forEach((time, index) => {
            numerator = finite(numerator + finite((time - meanTime) * (logs[index] - meanLog)));
            denominator = finite(denominator + (time - meanTime) ** 2);
          });
          const slope = finite(numerator / positive(denominator));
          raw.slope = slope;
          if (slope > SLOPE_EPSILON) {
            raw.days = positive(Math.LN2 / slope);
            raw.value = positive(raw.days / MONTH_DAYS);
            result('PSA Doubling Time', format(raw.value, 2) + ' months');
          } else result('PSA trend', slope < -SLOPE_EPSILON ? declining : flat);
          notes.push(`Based on ${values.length} measurements; natural-log linear regression.`);
          notes.push('1 month = 30.4375 days.');
          if (values.length === 2) notes.push('Two-point estimate; interpretation is sensitive to measurement variation.');
        }
      } else if (kind === 'ipss') {
        const scores = symptoms.map((label, index) => score(`q${index + 1}`, 5, `Select a score from 0 to 5 for ${label.toLowerCase()}.`));
        const qol = score('qol', 6, 'Select a QoL score from 0 to 6, or leave it unanswered.', true);
        if (shouldCalculate()) {
          raw.value = scores.reduce((sum, value) => sum + value, 0);
          raw.qol = qol;
          result('IPSS symptom score', `${raw.value} / 35`);
          result('Symptom severity', raw.value <= 7 ? 'Mild' : raw.value <= 19 ? 'Moderate' : 'Severe');
          result('QoL score', qol === null ? 'Not answered' : `${qol} / 6`);
          if (raw.value === 0) notes.push('No symptoms reported.');
        }
      } else if (kind === 'egfr') {
        const age = number('age', 'age in years', { integer: true, min: 18 });
        const sex = option('sex', ['female', 'male'], 'Select Female or Male for the equation.');
        const unit = option('unit', ['mg/dL', 'µmol/L'], 'Select mg/dL or µmol/L.');
        const creatinine = number('creatinine', `serum creatinine (${unit})`);
        if (shouldCalculate()) {
          const scr = positive(unit === 'µmol/L' ? creatinine / 88.4 : creatinine);
          const kappa = sex === 'female' ? 0.7 : 0.9;
          const alpha = sex === 'female' ? -0.241 : -0.302;
          const ratio = positive(scr / kappa);
          const low = positive(Math.min(ratio, 1) ** alpha);
          const high = positive(Math.max(ratio, 1) ** -1.2);
          const ageFactor = positive(0.9938 ** age);
          raw.value = positive(positive(positive(positive(142 * low) * high) * ageFactor) * (sex === 'female' ? 1.012 : 1));
          result('eGFR', format(raw.value, 1) + ' mL/min/1.73 m²');
          notes.push('CKD-EPI 2021, creatinine');
        }
      } else errors._form = NUMERICAL_ERROR;
    } catch (error) {
      if (!(error instanceof RangeError) || error.message !== NUMERICAL_ERROR) throw error;
      errors._form = NUMERICAL_ERROR;
    }
    if (fields !== null) return { errors };
    return valid() ? { ok: true, lines, notes, raw } : { ok: false, errors };
  }
  function calculate(kind, input, today) { return evaluate(kind, input, today); }
  function validateFields(kind, input, fieldIds, today) {
    return evaluate(kind, input, today, new Set(fieldIds)).errors;
  }
  return Object.freeze({ calculate, validateFields, decimal, calendarDay, localToday, format, symptoms: Object.freeze(symptoms), MONTH_DAYS, SLOPE_EPSILON });
});
