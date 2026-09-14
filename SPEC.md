# Urology Toolbox — Specification v0.1

Status: Urology Toolbox v0.1 implementation complete. See [VERIFICATION.md](VERIFICATION.md) for executed checks and remaining verification gaps.

Project directory: `D:\AI-Projects\Urology-toolbox`

The specification-only phase is complete. This document remains the v0.1 requirements baseline for the implemented application; verification status is recorded in [VERIFICATION.md](VERIFICATION.md). Deployment is not part of the current phase.

## 1. Purpose and scope

A simple personal web application for a urologist, containing exactly five calculators:

1. PSA Density
2. PSA Doubling Time
3. Prostate Volume
4. IPSS
5. eGFR

The application must work in desktop and mobile browsers, use a clean professional clinical interface, and perform every calculation locally in the browser. There is no login, database, or patient record functionality. All examples, development fixtures, and verification inputs must be synthetic; no real patient data may be used.

The formulas and product choices below are fixed for this proposed v0.1. Clinical references support the calculation methods; navigation, formatting, validation timing, and numerical tolerances are product decisions.

## 2. Overall app structure

### 2.1 Main page and layout

- One page with a shared header, five calculator navigation controls, one active calculator panel, and a small footer.
- Header: **Urology Toolbox**, version **0.1**, and the short notice: “Calculations run in this browser. Entries are not saved.”
- Each calculator panel uses the same order: title, one-sentence purpose, labeled inputs with units, **Calculate** and **Clear** buttons, result, and a concise formula/method note with a supporting reference link.
- On first load, PSA Density is selected. All numeric inputs, dates, and IPSS answers are empty. Units have the explicitly specified defaults. Sex has no default selection.
- Results are absent until a valid calculation. Empty fields must never resemble a completed score or a zero result.
- Use a white background, dark readable text, muted blue or teal accents, clear spacing, and restrained borders. No decorative animation, charts, or unrelated dashboard content.
- Proposed v0.1 interface language: English, matching the requested calculator names. No language selector.
- Footer: a brief statement that calculated estimates require clinical interpretation. No mandatory acknowledgment dialog.

### 2.2 Navigation

- Display the five calculator names in the order above as labeled buttons. The active calculator is clearly indicated by text styling and a visual marker, not color alone.
- Desktop: navigation appears above the calculator panel in a horizontal row.
- Mobile: navigation wraps into multiple rows without truncated names or horizontal scrolling. Do not introduce a separate menu.
- Selecting another calculator replaces the active panel and clears the previous panel's entries, results, and errors. Returning to it shows an empty form and default units.
- Display a small notice near navigation: “Switching calculators clears entries.” No confirmation dialog is required.
- Calculators are independent. There is no automatic transfer from Prostate Volume to PSA Density.
- No separate home dashboard, account page, settings screen, or input values in URLs.

### 2.3 Mobile and accessibility behavior

- Below 768 CSS pixels, use a single-column form with units visible beside their labels. Wider displays may use two columns for short fields.
- Support widths down to 320 CSS pixels without horizontal page scrolling, clipped results, or overlapping controls.
- PSA date/value rows become stacked groups on narrow screens. Each group's remove button remains associated with that measurement.
- IPSS uses one labeled score selector per symptom and a separate optional QoL question with its own selector, avoiding a wide questionnaire matrix.
- Inputs and buttons have touch targets at least 44 CSS pixels high. Input text is at least 16 CSS pixels.
- Use persistent labels, visible keyboard focus, logical tab order, and text descriptions of errors. Every action must work by keyboard and touch.
- Request an appropriate decimal or integer mobile keyboard; dates use a date control with an unambiguous format hint.
- Normal text should meet a contrast ratio of at least 4.5:1. Zoom and a mobile keyboard must not hide required controls permanently.

### 2.4 Local processing and data lifecycle

- Static application assets may be served normally, but calculation must require no server request, API, external calculator, or remote model.
- Values exist only in the active form and transient browser memory needed for calculation. No patient identifiers, names, medical record numbers, birth dates, or free-text clinical notes are collected. eGFR uses age rather than date of birth.
- Do not write inputs or results to cookies, local storage, session storage, IndexedDB, files, URL parameters/fragments, browser history state, logs, analytics, or error-reporting services.
- Do not transmit entered values or results. No analytics, tracking scripts, third-party form services, or input-bearing requests.
- **Clear** immediately empties the active form, result, errors, and notices generated by a calculation; it restores default units. PSA Doubling Time returns to two empty measurement rows.
- Reloading, reopening, or restoring the page from browser back/forward navigation must initialize empty forms rather than restore prior entries. Request that browsers not autofill these fields; do not rely on that request alone for the application's reset behavior.
- Once initial assets are loaded, all five calculators must remain usable with the network disconnected. Installation, a service worker, and first-load offline access are outside v0.1.
- Static reference links are optional to open and must never contain inputs or results.

## 3. Shared calculation and error rules

### 3.1 Input handling

- All inputs listed as required must be present before calculating. Blank is not zero.
- Trim surrounding whitespace. Accept plain decimal numbers, including `0.5` and `.5`, with a period as the decimal separator. Do not accept commas, scientific notation, embedded units, trailing text, comparison signs, `NaN`, or infinity.
- Parse the entire entry; for example, `4abc`, `<0.1`, and `1,5` are invalid rather than partially converted.
- Never substitute, clamp, impute, or silently correct a clinically meaningful value. Apply the calculator-specific numerical domains below after parsing.
- Do not add arbitrary upper clinical cutoffs for positive measurements. Values must be representable as finite numbers, and all calculation steps must produce a valid finite result. Mathematical validity is not a claim of clinical applicability.
- A nonzero positive entry that becomes zero through numerical underflow is invalid. Overflow, underflow to an invalid zero result, or a non-finite intermediate/output must produce a calculation error.
- Changing a unit clears the associated measurement field(s) and any displayed result, requiring re-entry in the new unit. It does not reinterpret the existing number. Explain this beside the unit control.
- Calendar dates use `YYYY-MM-DD` semantics. Validate actual calendar dates and leap years; never silently normalize an impossible date. Use calendar-day differences independent of time zones and daylight saving time.

### 3.2 Calculation and display

- Calculate only when **Calculate** is activated or the form is explicitly submitted by keyboard. Do not calculate on each keystroke.
- Retain full numerical precision during conversion and calculation. Round only the displayed final value, using nearest rounding with exact halfway values rounded upward for nonnegative results.
- Display units alongside every numerical result. Do not format a positive value as zero merely because it is smaller than the display precision.

| Calculator | Normal display | Positive value below the display increment |
| --- | --- | --- |
| PSA Density | 3 decimal places | `<0.001 ng/mL/cc` |
| PSA Doubling Time | 2 decimal places in months | `<0.01 months` |
| Prostate Volume | 1 decimal place in mL | `<0.1 mL` |
| IPSS | Integer symptom total out of 35; separate optional integer QoL score out of 6 | Not applicable |
| eGFR | 1 decimal place | `<0.1 mL/min/1.73 m²` |

- The small-positive-value rule applies whenever the raw positive value is below the listed increment. Actual zero remains valid only where explicitly allowed.
- Editing any input, adding/removing a PSA measurement, or changing units immediately removes the prior result. Show “Inputs changed. Calculate again.” only if a result had been displayed.
- Results must never display `NaN`, infinity, negative doubling times, or an unexplained zero caused by a failed calculation.

### 3.3 Error message behavior

- Do not show errors when an untouched form first opens.
- On calculation, validate all required fields and show concise errors immediately beside the affected fields. Move focus to the first invalid field. Keep correctly entered values.
- After a failed calculation, revalidate an affected field when it loses focus; remove its error when corrected. A new result still requires Calculate.
- If any blocking error exists, hide the numerical result. Do not leave a stale result visible.
- Errors explain how to fix the input, for example: “Enter a prostate volume greater than 0 mL.”, “Select a score from 0 to 5 for urgency.”, or “Each PSA measurement must have a different date.”
- Cross-field errors identify the affected rows or group. Numerical failures use “Unable to calculate a finite result. Check the values and units.” Do not expose technical exceptions or echo inputs into logs.
- Announce new errors and results to assistive technology. Use text and styling, not color alone. Do not use alert dialogs or transient toast messages for validation.
- A valid but non-increasing PSA trend is a result status, not an invalid-input error. Clinical method limitations are brief inline notes, not additional required questions.

## 4. PSA Density

### 4.1 Purpose

Calculate serum total PSA relative to measured prostate volume. The output is a numerical PSA density; v0.1 does not assign a cancer risk category or a biopsy recommendation. PSA density is defined as PSA divided by prostate volume. [EAU diagnostic evaluation](https://uroweb.org/guidelines/prostatecancer/chapter/diagnostic-evaluation)

### 4.2 Required inputs

| Input | Requirement |
| --- | --- |
| Total PSA | Required decimal, greater than or equal to 0 |
| Prostate volume | Required decimal, greater than 0 |

Volume is entered manually from a measurement or a separately calculated estimate.

### 4.3 Units

- PSA: **ng/mL**, fixed.
- Prostate volume: **mL**, fixed; 1 mL = 1 cm³ = 1 cc.
- PSA density: **ng/mL/cc**, the conventional clinical display requested for this app, meaning PSA in ng/mL divided by prostate volume in cc. Because 1 cc = 1 mL, a volume entered in mL produces the same numerical result. It is not expressed in ng/mL alone.

### 4.4 Formula

**PSA density = PSA (ng/mL) / prostate volume (cc or mL)**

Use the entered volume directly, without rounding it before division.

### 4.5 Output

Display **PSA Density: {value} ng/mL/cc**, normally to three decimal places. Include the formula beneath the result. No automatic threshold highlighting.

### 4.6 Input validation

- Both inputs are required, finite, and subject to the shared parser rules.
- PSA must be at least 0; volume must be strictly greater than 0.
- Reject negative values, zero volume, and censored laboratory values such as `<0.1`.

### 4.7 Edge cases

- PSA exactly 0 with positive volume returns `0.000 ng/mL/cc`; this is an arithmetic result, not proof of absence of disease.
- Very small positive density uses the shared less-than display.
- Different volume-estimation methods can yield different densities. The app does not adjust or reconcile those measurements.
- A gland volume of zero, including an attempt to represent an absent prostate, cannot be used as a denominator.

### 4.8 Example test cases

All examples are synthetic.

| ID | PSA (ng/mL) | Volume (mL) | Expected result |
| --- | --- | --- | --- |
| PD-01 | 6 | 40 | `0.150 ng/mL/cc` |
| PD-02 | 4.5 | 30 | `0.150 ng/mL/cc` |
| PD-03 | 7 | 33 | Raw approximately 0.2121212121; display `0.212 ng/mL/cc` |
| PD-04 | 0 | 40 | `0.000 ng/mL/cc` |
| PD-05 | 0.01 | 100 | `<0.001 ng/mL/cc` |
| PD-06 | 6 | 0 | Volume error; no result |
| PD-07 | -1 | 40 | PSA error; no result |
| PD-08 | Blank or `<0.1` | 40 | Required/format error; no result |

### 4.9 Acceptance criteria

- All PD cases pass with the exact expected display or error state.
- The formula uses total PSA divided by volume, with no additional factors.
- Units, precision, zero handling, and division-by-zero prevention follow this specification.
- No diagnostic classification or treatment recommendation is generated.

## 5. PSA Doubling Time

### 5.1 Purpose

Estimate the time for PSA to double assuming an exponential trend, using ordinary least-squares regression of natural-log PSA against elapsed time. This is a mathematical trend estimate, not a prediction of tumor doubling or survival. The log-slope method is described by the [PSA Working Group](https://pmc.ncbi.nlm.nih.gov/articles/PMC2667701/).

For simplicity, v0.1 accepts at least two measurements. Two points provide a simplified estimate; three or more suitable serial measurements are preferable for clinical interpretation. The app does not enforce study-specific eligibility, treatment-state, or sampling-window rules. The [PCWG2 recommendations](https://pmc.ncbi.nlm.nih.gov/articles/PMC4010133/) discuss estimating pretreatment PSA doubling time when at least three values are available.

### 5.2 Required inputs

- At least **two complete measurement rows**, each containing a date and a PSA value.
- Start with two empty rows. Provide **Add measurement** and a row-specific **Remove** action; do not allow removal below two rows.
- Every displayed row is required. An unused added row must be removed; it is not silently ignored.
- Use every entered measurement with equal weight. Do not offer date-window selection, outlier removal algorithms, or alternative fitting methods.

### 5.3 Units

- PSA: **ng/mL**, fixed; values must be strictly positive because logarithms are used.
- Input dates: calendar dates, `YYYY-MM-DD`.
- Internal time: elapsed calendar **days** from the earliest measurement.
- Output: **months**, where one month is fixed at `365.25 / 12 = 30.4375 days`. This is a display convention, not calendar-month subtraction.

### 5.4 Formula

Order valid measurements by date for calculation without breaking each date/value pairing. For each measurement i:

- `tᵢ` = days since the earliest date.
- `yᵢ` = `ln(PSAᵢ)`; ln is the natural logarithm.
- `t̄` and `ȳ` = arithmetic means of all t and y values.
- Slope `b = Σ[(tᵢ − t̄)(yᵢ − ȳ)] / Σ[(tᵢ − t̄)²]`, in inverse days.
- For an increasing trend: **doubling time in days = ln(2) / b**.
- **Doubling time in months = ln(2) / (b × 30.4375)**.

For exactly two points, this equals `(t₂ − t₁) × ln(2) / ln(PSA₂ / PSA₁)` in days. Do not average separate pairwise doubling times when more measurements are present.

Numerical decision rule: use an absolute slope tolerance of **10⁻¹² day⁻¹**. If `b > 10⁻¹²`, calculate a positive doubling time. If `|b| ≤ 10⁻¹²`, report a flat trend. If `b < −10⁻¹²`, report a declining trend. This tolerance prevents floating-point noise from creating enormous apparent doubling times and is not a clinical cutoff.

### 5.5 Output

- Positive slope: **PSA Doubling Time: {value} months**, normally to two decimal places.
- Include “Based on {n} measurements; natural-log linear regression.” and the month conversion convention.
- With exactly two measurements, append: “Two-point estimate; interpretation is sensitive to measurement variation.”
- Flat trend: “PSA is effectively unchanged across these measurements; no finite doubling time.” No numerical doubling time.
- Negative slope: “PSA is declining across these measurements; doubling time is not applicable.” No negative doubling time and no conversion to a halving-time output.
- Method note: selection of measurements, short intervals, assay variation, and treatment changes affect interpretation. No automated risk category is displayed.

### 5.6 Input validation

- At least two complete rows, strictly positive finite PSA values, valid dates, and all dates unique.
- Reject zero, negative, blank, censored, or nonnumeric PSA values.
- Reject future measurement dates relative to the device's current local calendar date. Do not impose an arbitrary oldest date beyond the date control's supported calendar range.
- Duplicate dates are errors even if their PSA values match; do not combine them or choose one silently.
- Accept rows entered out of chronological order. Sorting is internal; keep visible row identities stable.
- The regression denominator must be positive and finite. All rows must pass validation before fitting.

### 5.7 Edge cases

- Equal PSA values yield the flat-trend status; decreasing values yield the declining-trend status.
- Non-monotonic values are allowed. Use the fitted slope from all measurements, even when the last value is lower than an intermediate value.
- Irregular intervals use actual elapsed days, not row indices or assumed equal spacing.
- Leap days and daylight saving transitions must not introduce off-by-one-day errors.
- A small positive PSA is mathematically accepted but may be sensitive to assay limits; do not treat a reported detection limit as an exact result.
- Very short intervals remain mathematically calculable, with the method limitation visible. A result is not a claim that the sampling is clinically adequate.
- Apply the shared finite-result and small-positive display rules; do not cap long doubling times at an invented maximum.

### 5.8 Example test cases

Notation: each pair is `(date, PSA in ng/mL)`. All measurements are synthetic; execute date-dependent tests with a device date after the fixtures.

| ID | Measurements | Expected result |
| --- | --- | --- |
| DT-01 | (2025-01-01, 2), (2025-04-11, 4) | 100 days; approximately 3.2854209446 months; display `3.29 months`, two-point note |
| DT-02 | (2025-01-01, 2), (2025-04-11, 4), (2025-07-20, 8) | Display `3.29 months`, based on 3 measurements |
| DT-03 | Same pairs as DT-02 entered in reverse order | Same result as DT-02 |
| DT-04 | (2025-01-01, 4), (2025-04-11, 4) | Flat-trend status; no numerical doubling time |
| DT-05 | (2025-01-01, 4), (2025-04-11, 2) | Declining-trend status; no numerical doubling time |
| DT-06 | (2025-01-01, 2), (2025-01-31, 8), (2025-04-11, 4) | Approximately 175.5555556 days; display `5.77 months`, proving all irregularly spaced points are used |
| DT-07 | (2024-02-28, 2), (2024-03-01, 4) | 2 days; display `0.07 months` |
| DT-08 | (2025-01-01, 2), (2025-01-01, 4) | Duplicate-date error; no result |
| DT-09 | (2025-01-01, 0), (2025-04-11, 4) | Positive-PSA error; no result |
| DT-10 | One complete row and one missing date; or an extra blank row | Required-field error; no result |
| DT-11 | Any row dated 2025-02-29, or tomorrow relative to the device | Invalid-date or future-date error; no result |
| DT-12 | (2025-01-01, 4), (2025-04-11, 4.000000000004) | Flat-trend status under the slope tolerance |

### 5.9 Acceptance criteria

- All DT cases pass. The same date/value pairs produce the same result regardless of entry order or device time zone.
- Use natural logarithms and ordinary least squares across all rows; DT-06 must not return the endpoint-only value of 3.29 months.
- The displayed method, measurement count, month convention, and two-point limitation match the actual calculation.
- Invalid data block calculation; flat and declining slopes produce the specified result statuses.
- Adding/removing rows clears previous results and preserves correct date/value associations.

## 6. Prostate Volume

### 6.1 Purpose

Estimate prostate volume from three orthogonal full-gland dimensions using the clinical ellipsoid approximation. This specification uses the **0.52 coefficient**, consistent with [ACR PI-RADS v2.1](https://www.acr.org/-/media/ACR/Files/RADS/Pi-RADS/PIRADS-v2-1.pdf). It does not perform image measurement or segmentation.

### 6.2 Required inputs

| Input | Meaning |
| --- | --- |
| Width | Maximum transverse diameter |
| Height / AP diameter | Maximum anterior-posterior diameter |
| Length | Maximum longitudinal / craniocaudal diameter |
| Dimension unit | One shared choice for all three values; default cm |

All three measurements are full diameters, not radii.

### 6.3 Units

- Input: **cm** or **mm**, selected once for the whole form. Mixed units within one calculation are not supported.
- Convert each millimeter dimension to centimeters by dividing by 10.
- Output: **mL**; 1 cm³ = 1 mL = 1 cc.

### 6.4 Formula

**Volume (mL) = 0.52 × width (cm) × height (cm) × length (cm)**

For mm inputs, the equivalent expression is `0.52 × width × height × length / 1000`.

Use 0.52 consistently. Do not silently substitute 0.523, π/6, a bullet formula, or another coefficient.

### 6.5 Output

Display **Estimated Prostate Volume: {value} mL**, normally to one decimal place, with “Ellipsoid approximation; coefficient 0.52.”

### 6.6 Input validation

- All dimensions must be present, finite, and strictly greater than 0.
- The unit must be one of the two supported options.
- Reject missing, zero, negative, malformed, or non-finite values. Changing units clears all three dimensions and the result.

### 6.7 Edge cases

- Equivalent cm and mm measurements must yield identical raw results before display rounding.
- Equal dimensions are permitted; changing the order of dimensions leaves the numerical product unchanged, although anatomical labels remain specific.
- The approximation may differ from measured or segmented volume in irregular glands. The app does not apply a shape correction or infer pathology from the size.
- Very small positive volumes use the shared display rule. Numerical overflow or invalid underflow yields an error.

### 6.8 Example test cases

| ID | Width × height × length | Unit | Expected result |
| --- | --- | --- | --- |
| PV-01 | 4 × 3 × 5 | cm | `31.2 mL` |
| PV-02 | 40 × 30 × 50 | mm | `31.2 mL` |
| PV-03 | 5 × 5 × 5 | cm | `65.0 mL` |
| PV-04 | 4.2 × 3.1 × 5.3 | cm | Raw 35.88312; display `35.9 mL` |
| PV-05 | 0.1 × 0.1 × 0.1 | cm | Raw 0.00052; display `<0.1 mL` |
| PV-06 | 4 × 0 × 5 | cm | Height error; no result |
| PV-07 | 4 × -3 × 5, or one blank dimension | cm | Field error; no result |
| PV-08 | Enter PV-01, calculate, then switch to mm | mm | All dimension fields and result cleared; no relabeling of 4, 3, and 5 as mm |

### 6.9 Acceptance criteria

- All PV cases pass, including the factor-of-1000 cubic unit conversion.
- The coefficient, full-diameter labels, input unit, and mL output are explicit.
- No volume is calculated from incomplete dimensions or mixed-unit assumptions.
- No weight in grams, automatic PSA density, or diagnostic size category is added.

## 7. IPSS

### 7.1 Purpose

Calculate the **International Prostate Symptom Score symptom total** and its severity band, and display an optional **Quality of Life (QoL) score** separately. v0.1 remains a clinician-facing entry form for the seven already determined symptom item scores, referring to symptoms over the preceding month, with the standard QoL question added after them. It does not introduce a newly worded or translated patient questionnaire.

The seven-item symptom total ranges from 0 to 35. The accompanying QoL question has its own 0–6 score and must never be added to the symptom total or used to determine symptom severity. The conventional symptom severity bands are supported by the [original clinical study](https://pubmed.ncbi.nlm.nih.gov/7490834/) and the [AUA BPH guideline](https://www.auajournals.org/doi/full/10.1097/01.ju.0000078083.38675.79).

### 7.2 Required and optional inputs

Seven required symptom item scores, each selected explicitly from the integers **0–5**:

| Item | Symptom label |
| --- | --- |
| Q1 | Incomplete emptying |
| Q2 | Frequency |
| Q3 | Intermittency |
| Q4 | Urgency |
| Q5 | Weak stream |
| Q6 | Straining |
| Q7 | Nocturia |

Each selector starts at “Select score,” not 0. Display a short instruction to enter item scores from the standard IPSS assessment. Q7 is the standard nocturia item score: 0 for no episodes, 1–4 for the corresponding number, and 5 for five or more episodes per night. Do not enter a raw count above 5 as a score. [IPSS item structure and scoring study](https://pmc.ncbi.nlm.nih.gov/articles/PMC4120208/)

Add a separate field labeled **Quality of Life due to urinary symptoms (optional)** after Q7. The standard question asks how the respondent would feel about living the rest of their life with their current urinary condition unchanged. Use the exact standard English survey question specified by [LOINC 81090-3, IPSS QoL question](https://loinc.org/81090-3), together with its standard response mapping below. The linked question is the wording reference; the explanatory sentence here is a summary, not replacement questionnaire wording. Include the question in the static form so answering it requires no network request.

| QoL score | Response |
| --- | --- |
| 0 | Delighted |
| 1 | Pleased |
| 2 | Mostly satisfied |
| 3 | Mixed (about equally satisfied and dissatisfied) |
| 4 | Mostly dissatisfied |
| 5 | Unhappy |
| 6 | Terrible |

The QoL selector starts at **Not answered** with no numerical score selected. The user may leave it unanswered or select one integer from 0 through 6. Each option shows both its score and response label. The field is optional as confirmed by the user; seven valid symptom scores are sufficient to calculate IPSS.

### 7.3 Units

Each symptom item is measured in **points**. The symptom total is **points out of 35**. QoL is a separate **score out of 6**, or **Not answered**. There are no measurement-unit controls.

### 7.4 Formula

**IPSS symptom score = Q1 + Q2 + Q3 + Q4 + Q5 + Q6 + Q7**

**QoL score = the selected QoL response score (0–6)**, or **Not answered** if omitted. QoL is not a summand in the IPSS symptom score and does not change the severity band.

| Total | Displayed severity |
| --- | --- |
| 0–7 | Mild |
| 8–19 | Moderate |
| 20–35 | Severe |

At total 0, also show “No symptoms reported.” This clarifies the zero score while retaining the conventional 0–7 band. No weighting, missing-item prorating, or quality-of-life addition.

### 7.5 Output

Display three separate result lines:

- **IPSS symptom score: {integer} / 35**
- **Symptom severity: {Mild / Moderate / Severe}**
- **QoL score: {integer} / 6** when answered, or **QoL score: Not answered** when omitted.

The symptom category describes reported symptom burden; it does not diagnose obstruction or identify the cause of symptoms. Do not produce a combined symptom-plus-QoL score, a 41-point total, or an additional QoL severity category.

### 7.6 Input validation

- All seven symptom scores are required, with no preselected answer.
- Each symptom value must be an integer from 0 through 5, inclusive.
- Reject missing symptom answers, fractions, negative values, values greater than 5, and malformed values even if they reach the calculation outside the normal selector controls.
- QoL is optional. An unanswered QoL field is valid and remains **Not answered**; never convert it to 0 or include it in missing-required-field errors.
- If QoL is supplied, it must be one finite integer from 0 through 6, inclusive. Reject negative values, values above 6, fractions, nonnumeric entries, `NaN`, and infinity. A QoL value of 6 is valid even though a symptom item value of 6 is invalid.
- Invalid supplied QoL blocks calculation and hides all result lines under the shared error behavior. Show: “Select a QoL score from 0 to 6, or leave it unanswered.” Preserve valid symptom inputs.

### 7.7 Edge cases

- Seven explicit zero answers are valid; seven unanswered selectors are incomplete.
- Scores 7/8 and 19/20 must fall into their respective adjacent categories without gaps or overlaps.
- A nocturia count of six or more corresponds to item score 5, not a new score beyond the standard range.
- No partial total is displayed when any required symptom item is unanswered, even if QoL is valid.
- An unanswered QoL field still permits a complete symptom score and severity; display **QoL score: Not answered**.
- Explicit QoL 0 is a valid answer distinct from an unanswered field. QoL 6 is also valid; a symptom score of 35 with QoL 6 remains **35 / 35** and **6 / 6** separately.
- Changing or removing only the QoL answer clears the previous result under the shared edit rule. After Calculate, the unchanged symptom inputs produce the same symptom score and severity.
- Clear and calculator navigation reset the QoL field to **Not answered**, just as they clear the symptom inputs.
- No storage, change-from-baseline score, or treatment advice is provided.

### 7.8 Example test cases

All examples are synthetic. Lists follow Q1 through Q7 order. Unless an error is expected, display the three result labels specified in section 7.5. “Unanswered” means no QoL selection, not a score of 0.

| ID | Seven symptom scores | QoL | Expected result |
| --- | --- | --- | --- |
| IP-01 | 0, 0, 0, 0, 0, 0, 0 | 0 | `0 / 35`, Mild, “No symptoms reported.”; QoL `0 / 6` |
| IP-02 | 1, 1, 1, 1, 1, 1, 1 | Unanswered | `7 / 35`, Mild; QoL `Not answered` |
| IP-03 | 2, 1, 1, 1, 1, 1, 1 | 1 | `8 / 35`, Moderate; QoL `1 / 6` |
| IP-04 | 3, 3, 3, 3, 3, 2, 2 | 2 | `19 / 35`, Moderate; QoL `2 / 6` |
| IP-05 | 3, 3, 3, 3, 3, 3, 2 | 3 | `20 / 35`, Severe; QoL `3 / 6` |
| IP-06 | 5, 5, 5, 5, 5, 5, 5 | 6 | `35 / 35`, Severe; QoL `6 / 6`; never a total of 41 |
| IP-07 | 0, 0, 0, 0, 0, 0, blank | 4 | Missing-Q7 error; no result lines |
| IP-08 | Any symptom item is -1, 6, or 2.5 | 5 | Symptom-item error; no result lines |
| IP-09 | 3, 3, 3, 3, 3, 3, 2 | Test each integer 0–6 separately | Every run returns `20 / 35`, Severe; only the separate QoL score changes |
| IP-10 | 0, 0, 0, 0, 0, 0, 0 | Unanswered | `0 / 35`, Mild, “No symptoms reported.”; QoL `Not answered`, distinct from IP-01 |
| IP-11 | 1, 1, 1, 1, 1, 1, 1 | Test -1, 7, 2.5, `abc`, `NaN`, and infinity separately | QoL validation error; no result lines; symptom inputs preserved |
| IP-12 | Calculate IP-05, then change QoL to 6 and calculate again | 3 → 6 | Result clears on edit; recalculation still gives `20 / 35`, Severe; QoL becomes `6 / 6` |
| IP-13 | Calculate IP-05, then remove only the QoL answer and calculate again | 3 → Unanswered | Result clears on edit; recalculation gives `20 / 35`, Severe; QoL `Not answered` |
| IP-14 | Calculate IP-06, then Clear; repeat using navigation away and back | 6 → Unanswered | All symptom selectors empty, QoL `Not answered`, and no result lines |

### 7.9 Acceptance criteria

- All IP cases pass, including every severity boundary, every valid QoL score, and the distinction between unanswered QoL and explicit QoL 0.
- Sum exactly seven unweighted integer scores and always produce an integer from 0 to 35.
- The form clearly identifies itself as item-score entry and does not imply that short symptom labels constitute a validated patient questionnaire.
- Display the standard QoL question referenced in section 7.2, its 0–6 response mapping, and a clear optional label. Do not make QoL mandatory or preselect a numerical answer.
- Always display symptom score, symptom severity, and QoL separately after a valid calculation; unanswered QoL shows **Not answered**.
- No eighth score is added to the symptom total; changing QoL alone never changes the symptom score or severity after recalculation. No disease diagnosis is inferred from either score.
- Invalid supplied QoL follows the specified validation behavior, and QoL follows the existing clear, edit, and navigation reset rules.

## 8. eGFR

### 8.1 Purpose

Estimate adult glomerular filtration rate using the **2021 CKD-EPI creatinine equation**, without a race coefficient. This v0.1 choice uses creatinine alone to keep inputs minimal; it does not claim greater accuracy than combined creatinine–cystatin C estimation. Intended equation population: adults aged at least 18 years. [NIDDK adult equations](https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/glomerular-filtration-rate-equations/adults)

### 8.2 Required inputs

| Input | Requirement |
| --- | --- |
| Age | Completed years, integer, at least 18 |
| Sex used by the equation | Explicit Female or Male selection; no default |
| Serum creatinine | Positive decimal from an IDMS-standardized assay |
| Creatinine unit | mg/dL or µmol/L; default mg/dL |

No name, birth date, race, weight, height, or cystatin C input. The sex control selects published equation coefficients; the app does not infer a coefficient or provide a custom adjustment.

### 8.3 Units

- Age: **years**.
- Creatinine: **mg/dL** or **µmol/L**. Convert µmol/L to mg/dL by dividing by **88.4**.
- Output: **mL/min/1.73 m²**, indexed to standard body surface area. Do not label it simply mL/min or as creatinine clearance.

### 8.4 Formula

With serum creatinine `SCr` expressed in mg/dL:

**eGFR = 142 × min(SCr/κ, 1)^α × max(SCr/κ, 1)^(−1.200) × 0.9938^Age × F**

| Equation sex | κ | α | F |
| --- | --- | --- | --- |
| Female | 0.7 | −0.241 | 1.012 |
| Male | 0.9 | −0.302 | 1 |

`min` selects the smaller of its two arguments; `max` selects the larger. Apply the unit conversion before the formula and do not round intermediate values. Formula and coefficients: [National Kidney Foundation](https://www.kidney.org/ckd-epi-creatinine-equation-2021).

### 8.5 Output

- Display **eGFR: {value} mL/min/1.73 m²**, normally to one decimal place.
- Identify **CKD-EPI 2021, creatinine** beside the result.
- Do not cap values at 60 or 90 or replace them with a CKD stage. Numerical formatting does not imply measured-GFR precision.
- Concise method note: “Estimate for adults with stable kidney function. A single result does not establish CKD.”

### 8.6 Input validation

- Age is required, finite, a whole number, and at least 18. Do not silently round a fractional age.
- Both sex and a supported creatinine unit must be selected.
- Creatinine must be required, finite, and strictly positive in the selected unit.
- Reject zero, negative, malformed, or censored creatinine entries, including `<0.2`.
- Changing creatinine units clears the creatinine field and result while retaining age and sex.
- Under-18 input shows: “This calculator uses the adult CKD-EPI 2021 equation. Enter an age of at least 18 years.” No pediatric fallback.

### 8.7 Edge cases

- Age exactly 18 is accepted.
- At SCr = κ, both ratio powers equal 1. Values above and below κ must use the correct exponents.
- Equivalent creatinine values in the two supported units must return the same result.
- Very high or low creatinine still follows the formula if numerically valid; do not silently cap the result.
- Acute changes in kidney function, pregnancy, and substantial differences in muscle mass can make creatinine-based estimates unreliable. State these limitations briefly; the form does not attempt to detect them or add screening questions. [NIDDK clinical measurement limitations](https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/factors-affecting-egfr-accuracy/clinical-measurements)
- CKD staging, chronicity assessment, medication dosing, and conversion to an individual's absolute GFR require information outside this calculator and are excluded.

### 8.8 Example test cases

All demographics and laboratory values below are synthetic. Expected numerical outputs use the equation above.

| ID | Age | Equation sex | Creatinine | Expected display (mL/min/1.73 m²) |
| --- | --- | --- | --- | --- |
| EG-01 | 60 | Male | 1.0 mg/dL | `86.2` (raw approximately 86.1626207797) |
| EG-02 | 60 | Female | 1.0 mg/dL | `64.5` (raw approximately 64.4950003539) |
| EG-03 | 60 | Male | 88.4 µmol/L | `86.2`, equal to EG-01 |
| EG-04 | 60 | Male | 0.9 mg/dL | `97.8` (male κ boundary) |
| EG-05 | 60 | Female | 0.7 mg/dL | `98.9` (female κ boundary) |
| EG-06 | 40 | Male | 0.6 mg/dL | `125.1` (below male κ) |
| EG-07 | 40 | Female | 0.5 mg/dL | `121.5` (below female κ) |
| EG-08 | 18 | Male | 1.0 mg/dL | `111.9` |
| EG-09 | 17 | Male | 1.0 mg/dL | Adult-age error; no result |
| EG-10 | 60 | Male | 0 or -1 mg/dL | Creatinine error; no result |
| EG-11 | 60.5 | Male | 1.0 mg/dL | Whole-year age error; no result |
| EG-12 | 60 | Unselected | 1.0 mg/dL | Sex-selection error; no result |
| EG-13 | 60 | Female | Blank or `<0.2` mg/dL | Required/format error; no result |

### 8.9 Acceptance criteria

- All EG cases pass, covering both sexes and creatinine values below, at, and above κ.
- Match the published 2021 coefficients exactly; no MDRD, CKD-EPI 2009, race adjustment, or Cockcroft–Gault substitution.
- EG-01 and EG-03 yield the same unrounded value within numerical tolerance.
- Output always includes body-surface-area indexing and the equation version.
- Under-18 and invalid inputs block calculation. No CKD diagnosis or medication recommendation is generated.

## 9. Overall acceptance criteria

These remain the acceptance criteria for v0.1. Implementation and automated verification have been performed; see [VERIFICATION.md](VERIFICATION.md) for actual results and environments. Cross-browser acceptance testing is not yet fully complete.

1. Exactly the five requested calculators are available; each meets its section's inputs, formula, output, validation, edge cases, and acceptance criteria.
2. All listed synthetic fixtures yield the specified rounded display or semantic error/status. Where raw references are supplied, use an absolute tolerance of 10⁻⁸ for PSA density/volume and 10⁻⁶ for doubling-time days or eGFR. Display strings must still match exactly; approximate reference values are not rounded inputs.
3. Each calculator also rejects blank, malformed, non-finite, and disallowed-domain inputs through the shared rules. Extreme numeric inputs never produce a misleading successful result.
4. After a valid calculation, changing an input immediately removes the result. Clear, calculator switching, refresh, and page restoration follow the stated reset behavior.
5. Complete a manual flow on desktop Chrome, Edge, Firefox, and Safari, and mobile Safari on iOS and Chrome on Android, using stable versions available when implementation is tested. Record the actual tested versions at that time.
6. Verify representative widths of 320, 375, 768, and 1440 CSS pixels, plus keyboard navigation, visible focus, and accessible labels/errors. No calculator requires horizontal page scrolling.
7. With initial assets loaded and the network disconnected, each calculator still completes a synthetic calculation.
8. Inspect browser network traffic and storage during entry, calculation, clearing, and navigation: no input/result transmission, persistence, analytics, or logging occurs.
9. Confirm there is no login, database, patient identity field, real patient fixture, saved history, or additional calculator.

## 10. Scope exclusions for v0.1

- Authentication, accounts, roles, cloud sync, backend services, and databases.
- Patient records, identifiers, real patient examples, saved inputs, histories, favorites, and persistent preferences.
- Importing laboratory files, spreadsheets, images, DICOM, OCR, EHR integration, or external clinical APIs.
- Export, download, print-report, share-result, or dedicated copy-result features.
- Charts, longitudinal dashboards, PSA velocity, prostate cancer prediction models, biopsy recommendations, and treatment advice.
- Automatic linking between calculators, alternate prostate-volume formulas, or advanced fitting/measurement-selection options.
- Translated questionnaires, a full seven-symptom patient questionnaire, and longitudinal symptom comparison. The standard optional IPSS QoL question and its separate score are included in v0.1.
- Pediatric eGFR, cystatin C equations, MDRD, CKD-EPI 2009, Cockcroft–Gault, CKD staging, drug dosing, and body-surface-area de-indexing.
- Native mobile applications, PWA installation, service-worker caching, themes, language switching, and other personalization.
- During the completed specification-only phase, framework selection, implementation scaffolding, HTML, CSS, JavaScript, application code, package files, deployment configuration, and test code were excluded. This historical phase restriction does not describe the current implemented state.

Urology Toolbox v0.1 is implemented. Refer to [VERIFICATION.md](VERIFICATION.md) for verification status, including cross-browser acceptance work that remains incomplete.
