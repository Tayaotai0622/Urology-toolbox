# Urology Toolbox v0.1 — verification record

The original baseline results below are historical. The latest feature-branch checks, including the theme-only storage exception, are recorded in **Dark Mode feature verification — 2026-09-16** at the end of this file.

Executed: 2026-09-14, Windows. All fixtures are synthetic. `SPEC.md` was preserved without changes during initial implementation; this review-fix pass updates only its status/phase descriptions. Calculator requirements, formulas, and acceptance criteria are unchanged.

## Automated results

| Check | Result |
| --- | --- |
| JavaScript syntax | PASS |
| Node.js v22.16.0 calculation suite | 84 tests passed, 0 failed, 0 skipped |
| Chrome 153.0.8010.36 | 70 fixture variants, interaction checks, and four review regression checks passed |
| Edge 153.0.4234.32 | 70 fixture variants, interaction checks, and four review regression checks passed |
| Specification coverage | All 55 named synthetic cases covered; 140 browser fixture executions plus UI-only cases |

The 84 Node checks comprise 70 unchanged clinical fixture variants, eight existing coverage/edge-case checks, and six review regression checks. Successful command exit codes and PASS summaries were observed after the final application edits. Browser evidence is generated under `test-results/` (excluded from Git); the current report is `test-results/browser-report.json`.

### Review regression coverage

- M1: Field-scoped validation validates and reports only requested controls and does not run calculations. Browser checks confirm that blur after a failed calculation does not reveal errors on untouched scalar fields or newly added measurement rows. Correcting or introducing duplicate dates updates related date controls, including former peers. Calculate still validates the whole form.
- M2: Successful fixtures require options already present in the application UI. Both browsers verify that the actual µmol/L option works, then deliberately remove it and confirm the helper fails without recreating it. Injection is permitted only for the specific field named by a deliberate invalid-input fixture; an unflagged invalid QoL option is rejected by the helper.
- L1: Expected numerical RangeErrors retain the existing finite-result validation message. TypeError, ReferenceError, ordinary Error, and unrelated RangeError exceptions propagate unchanged. Tests also exercise a malformed measurement that causes a real TypeError.

The complete automated suites were run with `node --test --test-reporter=spec tests/calculators.test.cjs` and `node tests/browser.test.cjs`; both exited successfully. Syntax checks for `app.js` and `calculators.js` also passed. Browser test tooling is external to the application, as described in README.md.

### Case coverage

| SPEC IDs | Verification |
| --- | --- |
| PD-01–PD-08 | Node and both browsers; exact ng/mL/cc formatting, raw precision, zero, small positive values, invalid values |
| DT-01–DT-12 | Node and both browsers; regression, all-points fitting, irregular intervals, entry order, flat/declining slopes, leap dates, duplicate/missing/future dates, slope tolerance |
| PV-01–PV-07 | Node and both browsers; coefficient 0.52, cm/mm equivalence, raw precision, invalid and tiny dimensions |
| PV-08 | Both browsers; unit change clears dimensions and stale result |
| IP-01–IP-11 | Node and both browsers; severity boundaries, all QoL values 0–6, unanswered versus zero, invalid symptom/QoL inputs, separate scores |
| IP-12–IP-14 | Both browsers; QoL edit/removal, unchanged symptom result, Clear, navigation reset |
| EG-01–EG-13 | Node and both browsers; both sexes, below/at/above κ, µmol/L conversion, age 18 boundary, invalid inputs |

Additional checks cover whole-string decimal parsing, overflow, underflow, integer-field fractions below binary64 precision, negative-zero normalization, final-only rounding, invalid units, input immutability, and date arithmetic across time zones.

### Browser behavior

- All five calculators: no initial result, correct defaults, explicit Calculate, stale-result clearing, Clear, and switch-away/return reset.
- PSA rows: add/remove controls, minimum two rows, identity and date/value pairing preserved after removing a middle row.
- eGFR unit change clears creatinine while retaining age and sex.
- Errors: invalid field focus, inline messages, preserved valid inputs, correction on blur, keyboard submission, and visible keyboard focus.
- Regression check: Clear still works when clicking it causes a corrected input to lose focus; blur-message layout changes cannot swallow the click.
- Refresh, a persisted `pageshow` event, and actual navigate-away/back all restore an empty PSA Density form. The event test covers the reset handler; a back navigation is not asserted to have used BFCache on every run.
- Both browsers pass at 320, 375, 768, and 1440 CSS pixels. All five forms have no horizontal page overflow, out-of-viewport controls, touch targets below 44 pixels, or input text below 16 pixels. A 720-pixel reflow check additionally approximates the layout effect of 200% zoom; it is not a physical browser-zoom test.
- All five calculators work after the test context is put offline, with no attempted calculation requests.
- Direct `file://` opening and a synthetic PSA Density calculation pass in both browsers.
- PSA date arithmetic is checked in Asia/Taipei and America/New_York.
- No application console errors or uncaught page exceptions were observed.

### Privacy and source inspection

- Network capture showed only GET requests for the page and three local assets during loading/reloading. No requests occurred during calculator entry, calculation, clearing, or switching; none carried inputs or results.
- Browser checks found empty local storage, session storage, cookies, IndexedDB, Cache Storage, and service-worker registrations; no observed `Storage.setItem` calls; no query/hash values or history state.
- Source inspection found no application storage, logging, analytics, tracking, fetch/XHR, beacon, or history-writing calls. External URLs occur only in static, user-selected clinical reference links.
- The content security policy blocks network connections and form submission. Values are held only in the active form and transient calculation calls. No patient identity field or real patient fixture exists.

## Manual review (initial implementation)

- Reviewed the rendered desktop interface and mobile screenshots for all five calculators, including narrow 320-pixel layouts and IPSS's separate QoL section. Labels, units, navigation wrapping, field stacking, result wrapping, and spacing were checked visually.
- In the Codex in-app browser, manually entered synthetic PSA 6 and volume 40 and observed `0.150 ng/mL/cc`; changed PSA to a censored value and confirmed the old result disappeared, calculation showed an inline error, and focus returned to the invalid field; switched calculators and confirmed fields/errors/results were cleared.
- Reviewed the automated network/storage evidence and the application sources for data persistence.
- Checked the normal-text palette numerically. The lowest checked text/background contrast is approximately 5.52:1, above the specified 4.5:1. Disabled controls are outside this normal-text assessment.

## Remaining verification limitations

- Firefox is not installed in this environment; no Firefox run is claimed.
- Desktop Safari and Safari on iOS require Apple environments unavailable here. Physical Android Chrome was also unavailable. Desktop Chrome/Edge viewport checks do not replace these device-specific checks.
- Actual virtual-keyboard behavior, native mobile date/select pickers, true browser zoom, and VoiceOver/NVDA/TalkBack speech were not verified. Labels, live-region markup, focus styling, and keyboard navigation were checked, but these are not a full assistive-technology audit.
- Full cross-browser acceptance testing remains incomplete; not every browser/device acceptance item in SPEC section 9.5 has been completed. All listed synthetic cases and the available-environment checks above pass, with no known failing test remaining.
- This verification establishes the specified software behavior on the tested environments, not validation of clinical applicability beyond the formulas and limitations in SPEC.md.

No deployment, remote repository, GitHub connection, backend, database, login, or external API was created.

## Dark Mode feature verification — 2026-09-16

Branch: `feature/dark-mode`. The new appearance behavior is separate from the unchanged v0.1 calculator requirements in `SPEC.md`. `app.js`, `calculators.js`, and the original clinical fixture data/tests are unchanged from `main`. The baseline's statements about no storage apply before this feature; this branch permits only an appearance preference.

### Automated results

| Check | Result |
| --- | --- |
| New theme script and theme-check syntax | PASS |
| Existing calculation suite | 84 passed, 0 failed, 0 skipped |
| Chrome 153.0.8010.48 | All 70 fixture variants and original interaction/regression checks passed in each theme |
| Edge 153.0.4234.32 | All 70 fixture variants and original interaction/regression checks passed in each theme |
| Total clinical browser coverage | 280 fixture executions; all 55 named SPEC cases covered in both themes and browsers |
| Theme behavior | System light/dark defaults, live system changes before manual choice, click/keyboard switching, manual override of system settings, localStorage persistence, reload and reopening all passed |
| Storage resilience | Invalid preference, blocked storage reads, and failed storage writes passed; switching and calculations remain available |

Executed `node --test --test-reporter=spec tests/calculators.test.cjs` and `node tests/browser.test.cjs`; both returned exit code 0. `test-results/browser-report.json` contains the latest results; screenshots and reports remain ignored by Git.

- With no manual theme selection, the original strict zero-storage checks still pass. When selected manually, localStorage contains only `urology-toolbox-theme` with `light` or `dark`. Theme tests check every observed storage write and confirm that inputs and results are not saved. Switching the theme makes no network request.
- Theme switching preserves current calculator inputs, results, and displayed errors. Clear and calculator navigation do not remove the appearance preference; reload still resets calculator inputs as before.
- Both themes pass the existing 320, 375, 768, 1440, and 720 CSS-pixel layout checks, including touch-target size, visible controls, text size, and overflow checks for all five calculators. The 720-pixel check approximates reflow and is not an actual browser-zoom test.
- Rendered normal-text samples meet 4.5:1: the lowest sampled ratio is 5.52:1 in light mode and 6.19:1 in dark mode. Error text measures 7.05:1 and 7.87:1 respectively. Sampled input/button borders and the theme button's keyboard focus outline meet 3:1. Disabled controls are excluded from these contrast checks.
- Offline calculations, direct `file://` opening, and both tested time zones pass in each theme. Preference persistence tests use the local HTTP origin.
- Visually reviewed desktop dark-mode PSA Density/Doubling Time, 320-pixel light/dark PSA Density, and 375-pixel dark IPSS/eGFR screenshots. The switch remains at the top right, with readable fields, results, and footer content.

### Remaining limitations

Firefox, desktop Safari, physical iOS/Android browsers, native mobile pickers/keyboards, actual browser zoom, and screen-reader speech were not tested. Full cross-browser and assistive-technology acceptance testing remains incomplete. If localStorage is unavailable, switching works for the current visit but the new preference cannot be guaranteed to survive reload.

This feature has not been merged into `main`, pushed, or deployed. No Git tag was changed.
