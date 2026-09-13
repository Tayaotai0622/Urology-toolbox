/* One active form. Rendering or leaving the page discards all entered values. */
(function () {
  'use strict';
  const engine = window.UrologyCalculators;
  const panel = document.getElementById('calculator');
  const navigation = document.querySelector('nav');
  let active = 'density';
  let nextRow = 0;
  let attempted = false;
  let actionPointer = false;

  const definitions = {
    density: {
      title: 'PSA Density',
      purpose: 'Calculate total PSA relative to measured prostate volume.',
      formula: 'PSA density = PSA (ng/mL) / prostate volume (cc or mL)',
      note: '1 mL = 1 cc. Use the measured or separately estimated volume. Volume-estimation methods may yield different densities.',
      reference: ['EAU · PSA density', 'https://uroweb.org/guidelines/prostatecancer/chapter/diagnostic-evaluation']
    },
    doubling: {
      title: 'PSA Doubling Time',
      purpose: 'Estimate PSA doubling time from two or more dated measurements.',
      formula: 'Doubling time (months) = ln(2) / (b × 30.4375), where b is the slope of ln(PSA) against elapsed days.',
      note: 'Uses all measurements with equal weight. Three or more suitable serial measurements are preferable for clinical interpretation. Short intervals, assay variation, treatment changes, and measurement selection affect the estimate. This does not estimate tumor doubling or survival.',
      reference: ['PSA Working Group · regression method', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2667701/']
    },
    volume: {
      title: 'Prostate Volume',
      purpose: 'Estimate gland volume from three orthogonal full diameters.',
      formula: 'Volume (mL) = 0.52 × width (cm) × height (cm) × length (cm)',
      note: 'Ellipsoid approximation; coefficient 0.52. Enter full diameters, not radii. Estimates may differ from segmented volume in irregular glands. 1 cm³ = 1 mL = 1 cc.',
      reference: ['ACR · PI-RADS v2.1', 'https://www.acr.org/-/media/ACR/Files/RADS/Pi-RADS/PIRADS-v2-1.pdf']
    },
    ipss: {
      title: 'IPSS',
      purpose: 'Calculate the seven-item symptom score and a separate optional quality-of-life score.',
      formula: 'IPSS symptom score = Q1 + Q2 + Q3 + Q4 + Q5 + Q6 + Q7',
      note: '0–7: Mild · 8–19: Moderate · 20–35: Severe. QoL is scored separately from 0–6 and is never added to the symptom score. Symptom severity does not diagnose obstruction or its cause.',
      reference: ['LOINC · standard IPSS QoL question', 'https://loinc.org/81090-3']
    },
    egfr: {
      title: 'eGFR',
      purpose: 'Estimate adult glomerular filtration rate using CKD-EPI 2021 creatinine.',
      formula: 'eGFR = 142 × min(SCr/κ, 1)^α × max(SCr/κ, 1)^(−1.200) × 0.9938^Age × F',
      note: 'SCr in mg/dL; µmol/L ÷ 88.4. Female: κ = 0.7, α = −0.241, F = 1.012. Male: κ = 0.9, α = −0.302, F = 1. Estimate for adults with stable kidney function. A single result does not establish CKD. Acute changes, pregnancy, and substantial differences in muscle mass can make this estimate unreliable.',
      reference: ['NIDDK · adult eGFR equations', 'https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/glomerular-filtration-rate-equations/adults']
    }
  };

  // Only authored constants are used in templates; user input is never inserted as HTML.
  function field(id, label, { unit = '', hint = '', type = 'text', integer = false, options = null, optional = false, wide = false } = {}) {
    const described = `${hint ? `hint-${id} ` : ''}error-${id}`;
    const control = options
      ? `<select id="${id}" name="${id}" ${optional ? '' : 'required'} aria-describedby="${described}" autocomplete="off">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select>`
      : `<input id="${id}" name="${id}" type="${type}" ${type === 'date' ? `min="0001-01-01" max="${engine.localToday()}"` : `inputmode="${integer ? 'numeric' : 'decimal'}" spellcheck="false"`} required autocomplete="off" aria-describedby="${described}">`;
    return `<div class="field${wide ? ' wide' : ''}"><label for="${id}">${label}${unit ? ` <span class="unit" data-unit-for="${id}">${unit}</span>` : ''}</label>${control}${hint ? `<p id="hint-${id}" class="hint">${hint}</p>` : ''}<p class="error" id="error-${id}" hidden></p></div>`;
  }
  function formFields(kind) {
    if (kind === 'density') return `<div class="form-grid">${field('psa', 'Total PSA', { unit: 'ng/mL' })}${field('volume', 'Prostate volume', { unit: 'mL', hint: '1 mL = 1 cc' })}</div>`;
    if (kind === 'volume') return `<div class="form-grid">${field('unit', 'Dimension unit', { options: [['cm', 'cm'], ['mm', 'mm']], hint: 'One unit for all dimensions. Changing units clears all three values.', wide: true })}${field('width', 'Width', { unit: 'cm', hint: 'Maximum transverse diameter' })}${field('height', 'Height / AP diameter', { unit: 'cm', hint: 'Maximum anterior-posterior diameter' })}${field('length', 'Length', { unit: 'cm', hint: 'Maximum longitudinal / craniocaudal diameter' })}</div>`;
    if (kind === 'doubling') return '<div id="measurements"></div><p id="error-measurements" class="error" hidden></p><button class="secondary" type="button" id="add-measurement">Add measurement</button>';
    if (kind === 'ipss') {
      const options = [['', 'Select score'], ...[0, 1, 2, 3, 4, 5].map(value => [value, String(value)])];
      const qolOptions = [['', 'Not answered'], ['0', '0 — Delighted'], ['1', '1 — Pleased'], ['2', '2 — Mostly satisfied'], ['3', '3 — Mixed (about equally satisfied and dissatisfied)'], ['4', '4 — Mostly dissatisfied'], ['5', '5 — Unhappy'], ['6', '6 — Terrible']];
      return `<p class="form-note">Item-score entry: enter scores from the standard IPSS assessment for the preceding month. All seven symptom scores are required.</p><div class="form-grid">${engine.symptoms.map((label, index) => field(`q${index + 1}`, `${index + 1}. ${label}`, { unit: '0–5 points', options, hint: index === 6 ? '0 = none; 1–4 = corresponding nightly episodes; 5 = five or more.' : '' })).join('')}<div class="qol-field wide"><p class="qol-question" id="qol-question">If you were to spend the rest of your life with your urinary condition just the way it is now, how would you feel about that?</p>${field('qol', 'Quality of Life due to urinary symptoms (optional)', { options: qolOptions, optional: true, hint: 'Scored separately. Leaving this unanswered does not prevent an IPSS calculation.' })}</div></div>`;
    }
    return `<div class="form-grid">${field('age', 'Age', { unit: 'years', integer: true, hint: 'Completed years; adults 18 and older.' })}${field('sex', 'Sex used by the equation', { options: [['', 'Select sex'], ['female', 'Female'], ['male', 'Male']] })}${field('unit', 'Creatinine unit', { options: [['mg/dL', 'mg/dL'], ['µmol/L', 'µmol/L']], hint: 'Changing units clears the creatinine value.' })}${field('creatinine', 'Serum creatinine', { unit: 'mg/dL', hint: 'Use an IDMS-standardized assay.' })}</div>`;
  }

  function render(kind, focusTitle = false) {
    active = kind;
    attempted = false;
    nextRow = 0;
    const definition = definitions[kind];
    panel.innerHTML = `<div class="panel-heading"><p class="eyebrow">Clinical calculator</p><h2 id="calculator-title" tabindex="-1">${definition.title}</h2><p class="purpose">${definition.purpose}</p></div><form id="calculator-form" novalidate autocomplete="off">${formFields(kind)}<div class="actions"><button type="submit" class="primary">Calculate</button><button type="button" id="clear" class="secondary">Clear</button></div><p id="form-error" class="error" tabindex="-1" hidden></p></form><p id="edit-notice" class="edit-notice" role="status" hidden></p><div id="error-announcement" class="sr-only" role="alert" aria-atomic="true"></div><div id="result-announcement" role="status" aria-atomic="true"><section id="result" class="result" aria-label="Calculation result" hidden></section></div><section class="method" aria-label="Calculation method"><h3>Method &amp; interpretation</h3><p class="formula">${definition.formula}</p><p>${definition.note}</p><a href="${definition.reference[1]}" target="_blank" rel="noopener noreferrer">${definition.reference[0]}<span class="sr-only"> (opens in a new tab)</span></a></section>`;
    navigation.querySelectorAll('[data-calculator]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.calculator === kind)));
    if (kind === 'doubling') { addRow(); addRow(); }
    if (kind === 'ipss') document.getElementById('qol').setAttribute('aria-describedby', 'qol-question hint-qol error-qol');
    if (focusTitle) document.getElementById('calculator-title').focus();
  }

  function addRow() {
    const key = nextRow++;
    const element = document.createElement('fieldset');
    element.className = 'measurement';
    element.dataset.key = key;
    element.innerHTML = `<legend></legend><div class="form-grid">${field(`date-${key}`, 'Measurement date', { type: 'date', hint: 'YYYY-MM-DD' })}${field(`psa-${key}`, 'PSA', { unit: 'ng/mL' })}</div><button type="button" class="remove">Remove</button>`;
    document.getElementById('measurements').append(element);
    updateRows();
    return element;
  }
  function updateRows() {
    const rows = [...panel.querySelectorAll('.measurement')];
    rows.forEach((row, index) => {
      row.querySelector('legend').textContent = `Measurement ${index + 1}`;
      const remove = row.querySelector('.remove');
      remove.disabled = rows.length <= 2;
      remove.setAttribute('aria-label', `Remove measurement ${index + 1}`);
    });
  }
  function collect() {
    const data = Object.fromEntries(new FormData(document.getElementById('calculator-form')));
    if (active === 'doubling') data.measurements = [...panel.querySelectorAll('.measurement')].map(row => ({ key: row.dataset.key, date: document.getElementById(`date-${row.dataset.key}`).value, psa: document.getElementById(`psa-${row.dataset.key}`).value }));
    return data;
  }
  function invalidate() {
    const result = document.getElementById('result');
    if (!result.hidden) {
      const notice = document.getElementById('edit-notice');
      notice.hidden = false;
      notice.textContent = 'Inputs changed. Calculate again.';
    }
    result.replaceChildren();
    result.hidden = true;
    document.getElementById('form-error').hidden = true;
    document.getElementById('form-error').textContent = '';
  }
  function showErrors(errors, announce = false) {
    panel.querySelectorAll('input, select').forEach(control => {
      const message = errors[control.id];
      control.setAttribute('aria-invalid', String(Boolean(message)));
      const error = document.getElementById(`error-${control.id}`);
      error.textContent = message ?? '';
      error.hidden = !message;
    });
    const formError = document.getElementById('form-error');
    formError.textContent = errors._form ?? errors.measurements ?? '';
    formError.hidden = !formError.textContent;
    if (announce) document.getElementById('error-announcement').textContent = Object.keys(errors).length ? 'Check the highlighted fields. ' + [...new Set(Object.values(errors))].join(' ') : '';
  }
  function showResult(outcome) {
    const result = document.getElementById('result');
    result.replaceChildren();
    for (const line of outcome.lines) {
      const item = document.createElement('p'); item.className = 'result-line';
      const label = document.createElement('span'); label.className = 'result-label'; label.textContent = line.label + ': ';
      const value = document.createElement('span'); value.className = 'result-value'; value.textContent = line.value;
      item.append(label, value); result.append(item);
    }
    for (const text of outcome.notes) {
      const note = document.createElement('p'); note.className = 'result-note'; note.textContent = text; result.append(note);
    }
    result.hidden = false;
  }
  navigation.addEventListener('click', event => {
    const button = event.target.closest('[data-calculator]');
    if (button && button.dataset.calculator !== active) render(button.dataset.calculator, true);
  });
  panel.addEventListener('submit', event => {
    event.preventDefault();
    const outcome = engine.calculate(active, collect());
    attempted = !outcome.ok;
    invalidate();
    const notice = document.getElementById('edit-notice'); notice.hidden = true; notice.textContent = '';
    showErrors(outcome.ok ? {} : outcome.errors, true);
    if (outcome.ok) showResult(outcome);
    else (panel.querySelector('[aria-invalid="true"]') ?? document.getElementById('form-error')).focus();
  });
  panel.addEventListener('input', event => { if (event.target.matches('input, select')) invalidate(); });
  panel.addEventListener('change', event => {
    if (!event.target.matches('input, select')) return;
    invalidate();
    if (event.target.id === 'unit') {
      const ids = active === 'volume' ? ['width', 'height', 'length'] : ['creatinine'];
      ids.forEach(id => {
        document.getElementById(id).value = '';
        panel.querySelector(`[data-unit-for="${id}"]`).textContent = event.target.value;
      });
    }
  });
  panel.addEventListener('focusout', event => {
    // Do not shift an action button between pointerdown and click by inserting
    // or removing a blur error. That action will validate or reset the form.
    if (!attempted || actionPointer || !event.target.matches('input, select')) return;
    const outcome = engine.calculate(active, collect());
    showErrors(outcome.ok ? {} : outcome.errors);
  });
  panel.addEventListener('pointerdown', event => { actionPointer = Boolean(event.target.closest('button')); });
  document.addEventListener('pointerup', () => { actionPointer = false; });
  document.addEventListener('pointercancel', () => { actionPointer = false; });
  panel.addEventListener('click', event => {
    if (event.target.id === 'clear') {
      render(active);
      panel.querySelector('input, select')?.focus();
    } else if (event.target.id === 'add-measurement') {
      invalidate(); addRow().querySelector('input').focus();
    } else if (event.target.matches('.remove') && !event.target.disabled) {
      invalidate(); event.target.closest('.measurement').remove(); updateRows();
      document.getElementById('add-measurement').focus();
      if (attempted) { const outcome = engine.calculate(active, collect()); showErrors(outcome.ok ? {} : outcome.errors); }
    }
  });
  // pageshow also fires on back/forward-cache restoration; pagehide discards
  // the DOM before a page is cached. Neither handler writes browser storage.
  window.addEventListener('pagehide', () => render('density'));
  window.addEventListener('pageshow', () => render('density'));
  render('density');
})();
