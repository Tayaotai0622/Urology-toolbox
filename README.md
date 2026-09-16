# Urology Toolbox

A simple, browser-based educational and clinical utility tool with five urology calculators.

**Current version:** v0.1.0

**Live demo:** [Urology Toolbox](https://tayaotai0622.github.io/Urology-toolbox/)

## Calculators

- PSA Density
- PSA Doubling Time
- Prostate Volume
- IPSS with an optional, separate QoL score
- eGFR using the adult CKD-EPI 2021 creatinine equation

All calculations run locally in your browser. User inputs are not stored. This tool supports education and clinical practice; it does not replace clinical judgment.

## Open the application

Open `index.html` directly in a modern browser. No installation or build step is required. Keep `index.html`, `styles.css`, `calculators.js`, and `app.js` together.

For a local HTTP preview, optionally run this command in the project directory:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Open [the local preview](http://127.0.0.1:8765/). This serves static files on this computer only; it is not an application backend or deployment.

All calculations run locally. Clear, calculator switching, reload, and page restoration discard entries. No patient identifiers, saved results, storage, analytics, or external API are used. Clinical reference links open only when selected. Use synthetic data for development and testing.

## Structure

| File | Responsibility |
| --- | --- |
| `index.html` | Semantic page shell, navigation, local assets, and content security policy |
| `styles.css` | Responsive layout, clinical visual styling, focus and error states |
| `calculators.js` | Pure input validation, date arithmetic, formulas, and result formatting |
| `app.js` | One active form, events, accessible errors/results, and reset lifecycle |
| `tests/cases.cjs` | Synthetic fixtures mapped to SPEC case IDs |
| `tests/calculators.test.cjs` | Node's built-in test runner; formulas, parsing, precision, numerical edge cases |
| `tests/browser.test.cjs` | Optional development-only Playwright verification against installed Chrome/Edge |
| `VERIFICATION.md` | Executed checks, results, browser versions, and unverified environments |
| `SPEC.md` | Reviewed v0.1 requirements, preserved from the specification phase |

The application uses plain HTML, CSS, and JavaScript with no runtime dependencies. Classic scripts also allow direct `file://` use. The calculation module exposes the same pure functions to browser code and Node tests. No framework, package manifest, application server, database, or remote service is required.

## Re-run verification

Using Node.js 22 or later:

```powershell
node --test tests/calculators.test.cjs
```

The browser suite requires an existing Playwright installation available to Node, plus installed Chrome and Edge. This is test tooling only, not an application dependency:

```powershell
node tests/browser.test.cjs
```

If Playwright is in a separate tool directory, set `NODE_PATH` to that directory's `node_modules` for the current shell. To run one browser, use `node tests/browser.test.cjs chrome` or `node tests/browser.test.cjs msedge`.

The suite starts and stops its own loopback static server, uses isolated browser profiles, fixes the date to 2026-09-14 for date fixtures, and creates screenshots plus `browser-report.json` in ignored `test-results/`. Tests deliberately inject otherwise-unselectable invalid scores and an impossible date to verify defensive validation. No real patient data is included.

## Limits

Read `VERIFICATION.md` for the exact tested environments. Firefox, Safari, physical iOS/Android devices, and screen-reader speech still need device-specific checks. The mobile tests use desktop browser viewports; they do not certify a physical mobile browser or virtual keyboard. The app has no installation/PWA or first-load offline caching. Formula applicability and clinical interpretation remain as specified in `SPEC.md`.
