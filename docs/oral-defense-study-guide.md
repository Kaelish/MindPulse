# MindPulse oral-defense study guide

Prepared from the six module screenshots and this repository on 10 November 2026.
This is a study aid, not a certification of clinical accuracy, deployed permissions, or hardware compatibility. Code excerpts below are shortened unless explicitly described as exact. No application code was changed to prepare this guide.

## 1. Start with this explanation

> My assigned modules are Heart Rate Input, Reaction Time Test, Result Display, Recommendation, Data Management, and Report Generation. They connect the collection of assessment inputs to understandable results, self-care support, clinician review, and administrative reporting. The mobile application is built with React Native and Expo, while the administrator and doctor web portals use React. Both use a shared Supabase PostgreSQL database. The mobile facial-analysis flow additionally calls a Django emotion-analysis API. MindPulse supports stress awareness and professional follow-up; its output is not a medical diagnosis.

Memorize the flow, rather than memorizing every function:

```text
Mobile assessment inputs
  survey + manual pulse count + camera analysis + reaction test
                           |
                 normalize and combine
                           |
                preview result on mobile
                           |
                save to stress_sessions
                           |
             shared Supabase PostgreSQL
                  /                  \
       patient's own history     authorized web records
                                      |
                       clinician review / admin reports
```

Separate responsibilities:

- **Frontend:** screens, interaction, input checks, current stress-score calculation, charts, and file-download formatting.
- **Supabase:** authentication, shared database, row-level access rules, and other database services.
- **Django API:** facial-emotion inference in the current mobile scan path; it is not the route through which all assessment records are saved.
- **AI model versus scoring formula:** recognizing facial expression is the model's job. Combining inputs into a stress score is a separate, explicit weighted formula.

## 2. Understand the module table

CRUD means **Create**, **Retrieve**, **Update**, and **Delete**. An asterisk means that role has that operation in the supplied specification. It is not a measured software-quality score.

| Module | Admin, web | Doctor, web | User, mobile |
| --- | --- | --- | --- |
| Heart Rate Input | Retrieve | Retrieve | Create, Retrieve, Update |
| Reaction Time Test | Retrieve | Retrieve | Create, Retrieve, Update |
| Result Display | Retrieve | Retrieve | Retrieve |
| Recommendation | None listed | Create, Retrieve | Create, Retrieve |
| Data Management | Create, Retrieve, Update, Delete | Retrieve | None listed |
| Report Generation | Create, Retrieve | Retrieve | None listed |

The marked cells total 25: 5 + 5 + 3 + 4 + 5 + 3. This counts specified role-operation combinations, not proof that all combinations are implemented exactly as written.

**Important:** the current implementation differs from this table in some places. Explain the differences honestly and reconcile the manuscript with your adviser. A written design decision is not automatically an approved change to a signed specification.

## 3. Heart Rate Input

### Purpose and use

The user counts their pulse during a 15-second window and enters the beat count. The app estimates beats per minute (BPM):

```text
BPM = beats counted × (60 seconds / 15 seconds)
    = beats counted × 4

Example: 18 beats × 4 = 72 BPM
```

The timer provides 5 seconds of preparation followed by 15 seconds of counting. It does **not** use a smartwatch, Bluetooth heart-rate sensor, camera-based pulse measurement, or ECG.

### Important code

Files:

- `mindpulse-mobile/src/screens/heartrate/HeartRateTimerScreen.tsx:14` — timer constants.
- `mindpulse-mobile/src/screens/heartrate/HeartRateEntryScreen.tsx:57` — conversion and validation.
- `mindpulse-mobile/src/services/dashboard.ts:245` — shared session persistence.

```ts
const beats = parseInt(beatsInput, 10);
const bpm = beatsInput.length > 0 && !isNaN(beats) && beats > 0
  ? beats * MULTIPLIER
  : null;
const isValid = bpm !== null && bpm >= 30 && bpm <= 250;
```

Explain each part:

- `parseInt(..., 10)` converts the entered string to a base-10 integer.
- `isNaN` checks whether conversion failed.
- `null` means no usable reading yet, not zero BPM.
- `MULTIPLIER` is 4 because the counting interval is 15 seconds.
- The accepted BPM interval is an application input rule, not a clinical definition of a normal pulse.
- The field strips non-digit characters. A numeric keyboard alone would not guarantee valid input.
- Because an integer beat count is multiplied by four, actual accepted outputs are multiples of four: 32 through 248 BPM within the configured 30–250 range.

### Update and storage

Before submission, the user can repeat the measurement and replace the draft value. After submission, heart rate is part of a `stress_sessions` row, not a standalone heart-rate record with its own edit screen.

**Say:** “Update is implemented as correction or retaking before submission, not editing a previously submitted reading.” Get approval for this interpretation if the panel expects database UPDATE under that cell.

### Likely questions

**Why multiply by four?** A minute contains four 15-second intervals.

**Why not count for a full minute?** A shorter interval reduces interaction time, but it magnifies counting error. A longer interval or validated sensor could improve future measurements.

**How accurate is it?** The arithmetic is deterministic, but measurement accuracy depends on the user's counting, timing, and resting conditions. One missed beat changes the estimate by 4 BPM.

**Does a high pulse prove stress?** No. Exercise, caffeine, illness, medication, and other conditions can change pulse. This is an auxiliary input, not a standalone diagnosis.

**Is the timer medically precise?** It is an app countdown built with scheduled callbacks. Background suspension and scheduling can affect timing; keep the measurement screen active and validate timing on the demonstration device.

## 4. Reaction Time Test

### Purpose and use

The user waits for a visual signal and taps when the screen indicates “go.” The app records three valid attempts and calculates their rounded average in milliseconds.

```text
average = (attempt 1 + attempt 2 + attempt 3) / 3
Example: (280 + 310 + 310) / 3 = 300 ms
```

It is a behavioral input about response speed. It does not independently establish stress, intelligence, or a neurological condition.

### Important code

File: `mindpulse-mobile/src/screens/reaction/ReactionGameScreen.tsx:74`.

```ts
timer.current = setTimeout(() => {
  startedAt.current = performance.now();
  setPhase('go');
}, 1500 + Math.random() * 2000);

const time = Math.round(performance.now() - startedAt.current);
const average = attempts.length > 0
  ? Math.round(attempts.reduce((a, b) => a + b, 0) / attempts.length)
  : 0;
```

- The random wait is approximately 1.5–3.5 seconds, making the signal harder to predict.
- `performance.now()` is suitable for elapsed durations; it is not a calendar timestamp.
- `useRef` holds the start time and timer handle across renders without needing a display update.
- `useState` holds visible information such as phase and attempts.
- The phases are `idle`, `waiting`, `go`, and `results`.
- Tapping during `waiting` clears the pending timer and resets the current round; it does not add a successful attempt.
- Three recorded attempts lead to `results`.
- `reduce` adds the attempt values before dividing by their count.
- Effect cleanup clears a pending timer when the component unmounts.

The UI bands are fast at ≤250 ms, normal at >250 to ≤400 ms, and slow above 400 ms. These are application display categories, not established diagnostic cutoffs for this system.

### Likely questions

**Why three attempts?** Averaging reduces dependence on one accidental or unusually slow tap, but three attempts still provide a limited sample.

**Why randomize the delay?** To reduce anticipation and predictable tapping.

**What affects the result?** Attention, sleep, practice, motor ability, touchscreen latency, display refresh, and device performance.

**Is the measurement exact?** No. The code timestamps immediately before requesting the visual-state change, not the physical instant the new pixels appear. Rendering and input-event delays affect the recorded interval.

**What does Update mean here?** Retake before submitting. The saved average is stored in `stress_sessions.reaction_time_ms`.

## 5. Result Display and the scoring calculation

### Purpose

This module presents the calculated assessment output and retrieves saved results. The supplied table grants Retrieve to all three roles, subject to their authorized scope.

- A patient views their own result and history.
- A doctor views patients linked through the implemented appointment relationship.
- An administrator views oversight records.

An unsaved result preview can be calculated on the device. That does not mean the Result Display module itself independently creates a second result record; saving belongs to the assessment/session workflow.

### Know these files

- `mindpulse-mobile/src/services/stressFormula.ts` — canonical mobile scoring functions.
- `mindpulse-mobile/src/screens/assessment/AssessmentResultScreen.tsx:145` — formula use, rounding, and display categories.
- `mindpulse-mobile/src/services/dashboard.ts:245` — inserts the saved result.
- `mindpulse-web/src/services/assessmentOutcomes.ts` — web-side mirrored transforms for component displays.
- `mindpulse-web/src/services/admin.ts` — web result retrieval.

### How raw measurements become comparable

Each component maps onto a 0–100 scale; higher means more stress **according to the application's formula**.

| Input | Current transformation |
| --- | --- |
| Survey | Clamp the already normalized survey score to 0–100 |
| Heart rate | Clamp `(BPM - 60) × 2` to 0–100 |
| Reaction time | Clamp `(milliseconds - 250) / 3` to 0–100 |
| Face | Happy = 20, Neutral = 50, Sad = 80, adjusted by confidence |

“Clamp” means keep a value within a lower and upper limit. For example, a calculated 120 becomes 100; a calculated -10 becomes 0.

Face adjustment:

```text
face value = round(50 + (emotion base - 50) × confidence)
confidence is restricted to 0–1

Sad with confidence 1.0: 80
Sad with confidence 0.5: 65
Sad with confidence 0.0: 50
```

Low confidence pulls the facial contribution toward neutral. Model confidence is not proof of clinical correctness or a calibrated probability of stress.

### Weights and worked example

```text
Survey 50% + Heart rate 20% + Face 20% + Reaction time 10%
```

Using the example already asserted in `stressFormula.test.ts`:

```text
Survey = 70
Heart rate = 75 BPM → (75 - 60) × 2 = 30
Face = Sad, confidence 1.0 → 80
Reaction = 400 ms → (400 - 250) / 3 = 50

Final = 70×0.5 + 30×0.2 + 80×0.2 + 50×0.1
      = 35 + 6 + 16 + 5
      = 62 → High under the app's bands
```

Exact core aggregation from `stressFormula.ts:81`:

```ts
if (components.length === 0) return null;
const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
return components.reduce((sum, component) => sum + component.value * component.weight, 0) / totalWeight;
```

**Missing inputs:** the formula divides by the sum of available weights. This is renormalization. Heart rate and reaction alone have weights 0.2/0.3 and 0.1/0.3: two-thirds and one-third. Missing data is not treated as a measurement of zero.

**No inputs:** the formula returns `null`, but `AssessmentResultScreen` currently substitutes zero for display. Do not describe a no-data zero as evidence of low stress; this fallback needs explicit workflow verification or improvement.

**Bands on the rounded mobile result:**

- Low: 0–35.
- Moderate: 36–60.
- High: 61–100.

These are this application's fused-score bands. Do not present them as the standard raw PSS-10 categories or as medically validated cutoffs without research evidence.

### Saving and error handling

Shortened from `dashboard.ts`:

```ts
const { id: userId } = await requireUser();
const { data: inserted, error } = await supabase
  .from('stress_sessions')
  .insert({
    user_id: userId,
    score,
    stress_level: status,
    heart_rate: heartRate ?? null,
    reaction_time_ms: reactionTimeMs ?? null,
    // survey, face metadata, and notes are included in the real function
  })
  .select()
  .single();
if (error || !inserted) {
  throw new Error(error?.message || 'Could not save your assessment result.');
}
```

- `await` waits for an asynchronous result.
- `requireUser()` links the record to the signed-in account, not a typed-in owner ID.
- `.insert()` creates the row; `.select().single()` requests the inserted row back.
- `?? null` stores missing inputs as absent, not as fake zero readings.
- A database error is surfaced instead of claiming the result was saved.
- The screen has saving/already-completed guards, but do not claim a database-enforced exactly-once save without checking a relevant uniqueness constraint.
- Historical results use stored scores. Do not imply every history view recomputes them with today's formula.

### Difficult questions

**Why these exact weights?** “They are fixed design constants in this implementation. I can show their effect and verify the arithmetic. Their clinical suitability requires support from our approved methodology and validation data.” Do not invent experiments or citations.

**Is all of this AI?** No. Facial expression inference is model-based; the multimodal score is a programmed weighted calculation.

**Does 62 mean a 62% chance of having a disorder?** No. It is an index on the application's 0–100 scale.

**How do you know the algorithm works?** Separate arithmetic correctness, real-world measurement reliability, model-classification performance, and clinical validity. Unit tests address only part of this question.

**Can users manipulate their score?** Current scoring occurs client-side and the user submits the result. Ownership rules do not independently prove the submitted numeric values were honestly generated. Server-side recomputation/validation is a possible improvement.

## 6. Recommendation

### Two different kinds of guidance

1. **System self-care suggestions:** predefined rules select a tip bank by stress band. Actions include breathing, music, exercise, journaling, pauses, and navigating to professional-support resources.
2. **Clinician-authored recommendations:** a doctor writes a patient-linked record with category, priority, note, and status in `recommendations`.

These are not the same object. Choosing a self-care action does not mean the patient creates a clinician-authored database recommendation. The current tips are not generated by a language model.

Files:

- `mindpulse-mobile/src/services/selfCareTips.ts` — rule-based tip bank.
- `mindpulse-mobile/src/components/SelfCareModal.tsx` — patient-facing suggestions.
- `mindpulse-web/src/services/recommendations.ts:118` — clinician record creation.
- `mindpulse-web/src/services/consultations.ts:1007` — publishing patient-facing consultation notes.

Shortened clinician create operation:

```ts
const doctorId = await requireUserId();
const { error } = await supabase.from('recommendations').insert({
  doctor_id: doctorId,
  student_id: input.studentId,
  category: input.category,
  priority: input.priority,
  note: input.note,
  status: 'Active',
});
if (error) throw new Error(error.message);
```

`doctor_id` records the issuer; `student_id` records the subject. Error handling prevents a failed write from looking successful.

### The specification issue you must prepare for

The screenshot lists **User Create and Retrieve**. The design memo interprets user-facing functionality as self-care tips and published progress notes rather than access to internal clinician recommendations. That is an interpretation/deviation, not an exact implementation of patient-authored recommendation records.

There is a further security mismatch: the canonical SQL `recommendations_select` policy at `0001_canonical_schema.sql:852` allows either the subject student or issuing doctor to SELECT a recommendation. Therefore, the memo's claim that patients “cannot see” those rows is not enforced by that policy, even if the mobile interface does not show them.

**Safe defense answer:** “We distinguish system self-care guidance, internal clinician records, and published patient notes. The current UI follows that separation, but the signed module wording and database permission need reconciliation before we claim that restriction is fully enforced.”

Do not claim that hiding a screen is equivalent to database confidentiality. Do not claim this is a universal medical rule; it is a project-specific design decision requiring appropriate review.

## 7. Data Management

### Purpose

Data management covers organizing and retrieving records, applicable configuration, and controlled export/removal actions. It is an umbrella module, not necessarily a table called `data_management`.

| Screenshot operation | Current implementation interpretation |
| --- | --- |
| Admin Create | Creates a JSON export file, rather than creating arbitrary clinical data |
| Admin Retrieve | Reads permitted administrative records and export data |
| Admin Update | Changes supported portal settings; not unrestricted editing of submitted scores |
| Admin Delete | Selected staff-account removal in the UI; not an intended general clinical-record purge |
| Doctor Retrieve | Reads permitted case and assessment records |

Have your adviser approve these definitions if the module originally intended different entities or operations.

### JSON export

File: `mindpulse-web/src/services/dataExport.ts`.

The exporter attempts six tables: `profiles`, `doctor_profiles`, `stress_sessions`, `appointments`, `notifications`, and `recommendations`.

```ts
for (const table of EXPORT_TABLES) {
  const { data, error } = await supabase.from(table).select('*').limit(20000);
  if (error) errors.push(`${table}: ${error.message}`);
  else payload[table] = data ?? [];
}
```

- JSON preserves structured objects and arrays.
- Failures are listed in an `errors` field rather than aborting every successful table read.
- A successful download is not proof every table exported completely.
- The request uses a 20,000-row limit, but server response caps and lack of pagination can make the actual exported set smaller.
- RLS still filters rows. For example, a restrictive recommendation policy can produce an empty admin-visible set without a permission error.
- This is not a full database backup: it does not include every table, Auth state, storage files, database definitions, or a tested restoration procedure.

### Settings limitations

File: `mindpulse-web/src/services/adminSettings.ts`.

The remaining settings include theme/density, portal name, alert display gating, idle timeout, and frontend password-policy validation. Settings are saved in browser `localStorage`.

**Do not call them globally enforced server policies.** A browser-local password check or timeout is not equivalent to centrally configured Supabase Auth password/session enforcement.

### Permissions: know the difference between intent and SQL

The UI/design memo discourages admin purging of assessment records. However, `0001_canonical_schema.sql:737` still defines `stress_sessions_delete_admin`, which permits admin row deletion. No later repository migration was found removing it. Confirm actual deployed grants/policies before claiming the database forbids it.

Migration `0030_assessment_review_flags.sql` narrows authenticated UPDATE privileges to `reviewed_at` and `reviewed_by`; that protects score/input columns from ordinary client updates when applied. It does not remove the old admin DELETE policy. It also leaves the earlier self/admin UPDATE policy present, so “only doctors can ever edit review metadata” would need closer policy verification.

Clinical-record integrity is a design objective here, not a blanket statement that nothing can ever be deleted: user history erasure, account cascades, existing policies, and privileged service-role access must be considered.

## 8. Report Generation

### Purpose and output

Reports turn authorized source records into readable summaries. The admin report service supports five CSV report types:

1. Patient Stress Overview.
2. Assessment Results Summary.
3. At-Risk Patients Report.
4. Doctor Performance Report.
5. Monthly Trends Report.

File: `mindpulse-web/src/services/adminReports.ts`.

The current flow is: choose report → choose date range/filter → retrieve source data → filter/group → build columns → encode CSV → browser download.

The doctor also has CSV export functions, for example `mindpulse-web/src/views/doctor/AssessmentResultsView.tsx:85`. The screenshot grants the doctor Retrieve, but actual code also constructs a downloaded CSV. Explain this difference rather than denying the implemented export action.

### Important code

```ts
const csvCell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
```

CSV commas separate columns. A value containing a comma, quote, or newline needs quoting; embedded quotes are doubled. Otherwise a patient's name or note could break column alignment.

```ts
const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
const url = URL.createObjectURL(blob);
// A temporary anchor points to this URL and triggers the download.
URL.revokeObjectURL(url);
```

- `Blob` holds the file contents in browser memory.
- An object URL makes those bytes downloadable.
- Revoking the object URL releases the temporary reference after use.
- No matching report rows produces an error instead of pretending a meaningful report was generated.

### Likely questions

**CSV or PDF?** The inspected report service generates CSV, not a PDF report. Do not claim otherwise unless showing a separate implemented feature.

**CSV versus JSON?** CSV is a table suitable for spreadsheets. JSON represents structured data suitable for programmatic processing. Report generation and system export have different purposes.

**Why no Update/Delete?** These reports are generated on demand; this service does not maintain a saved report repository to edit or delete. Generating a new file does not change source rows.

**What does doctor performance mean?** Here it means counts such as appointments, completed appointments, and unique patients—not independently validated treatment effectiveness.

**Is the export secure?** The source query uses the signed-in user's database permissions. After download, the file is outside those live controls and must be handled securely. CSV quoting fixes formatting, not every spreadsheet risk; formula-injection handling for values beginning with `=`, `+`, `-`, or `@` needs separate assessment.

## 9. Unit testing: understand, do not just recite totals

### Basic explanation

> Unit testing checks a small piece of logic against an expected result. We use fixed inputs and replace external dependencies where appropriate, so a failure is easier to reproduce and locate. For example, a stress-formula test checks a known combination of inputs against the expected score of 62.

Use **Arrange → Act → Assert**:

1. Arrange the input or mock dependency.
2. Act by calling the function or interacting with the component.
3. Assert that the actual result equals the expected result.

An actual existing assertion in `mindpulse-mobile/src/services/stressFormula.test.ts:57`:

```ts
expect(fuseStressScore(70, 75, 'sad', 1, 400)).toBeCloseTo(62, 5);
```

- `expect` identifies the actual result.
- `toBeCloseTo` accommodates floating-point arithmetic.
- This verifies the coded arithmetic for one known case, not the clinical validity of 62.

Another actual test checks clamping:

```ts
expect(heartRateStress(60)).toBe(0);
expect(heartRateStress(75)).toBe(30);
expect(heartRateStress(120)).toBe(100);
```

### Tools and their roles

| Tool | What it does here |
| --- | --- |
| Jest | Runs web/mobile JavaScript and TypeScript tests, assertions, and mocks |
| React Testing Library | Renders web components and queries user-visible content |
| React Native Jest preset | Supplies mobile test-environment support |
| Django runner and DRF `APITestCase` | Exercise backend requests, validation, and responses |
| Python `unittest.mock` | Replaces the emotion model for predictable API tests |
| Mocked Supabase/AsyncStorage | Avoid dependence on live cloud data or physical-device storage |

The mobile manifest currently declares Jest 30; the old testing document's “Jest 29” description is stale. The backend uses Django's test runner, not pytest.

Some tests called “unit tests” in project documentation cross more than one internal component. In particular, Django API tests use actual routes, serializers, and a test database. Calling them API/component or integration-style tests is more precise than claiming every test is a pure isolated function test.

### Verified test execution in this checkout

| Layer | Command from that project directory | Observed result, 10 Nov 2026 |
| --- | --- | --- |
| Web | `npm test -- --watchAll=false --runInBand` | 18 suites passed; 119 tests passed |
| Mobile | `npm test -- --runInBand` | 9 suites passed, 2 failed; 122 tests passed, 2 failed |
| Backend | `..\.venv\Scripts\python.exe manage.py test core` | 21 tests passed; Django system checks reported no issues |

Total: **262 passed, 2 failed, 264 tests executed.** This is a dated observation, not a promise about other machines or later commits. The supplementary streak script was not run for this guide.

The mobile failures are in:

- `src/screens/survey/StressSurveyScreen.test.tsx`.
- `src/screens/assessment/StressAssessmentHubScreen.test.tsx`.

Both report that Jest cannot resolve `react-native/react-private-interface`. This is an observed test-environment/module-resolution failure, not proof the corresponding screens are correct or broken on a device. Repair and rerun it before presenting an all-green result; dependency versions, installed packages, and Jest resolution need investigation.

The backend run printed model-import/warmup and prediction-error logs while exercising mocked/error paths. Passing mocked endpoint tests does **not** establish that the real deployed inference model initializes or predicts correctly. Run a separate real-image integration check.

### Coverage of your six modules

| Module | Existing evidence inspected | Still needs dedicated evidence |
| --- | --- | --- |
| Heart rate | Formula transformation tests | Manual-entry boundaries, timer behavior, retake, and real-device measurement |
| Reaction | Reaction-to-score transformation tests | Random-delay/early-tap/three-round state machine and physical timing |
| Result display | Formula tests and dashboard/component suites | Dedicated final-result rendering and save/reload workflow |
| Recommendation | No dedicated recommendation-service/tip-selection test file found in the test inventory | Issuer/subject permissions, tip selection, publication, error states |
| Data management | Admin-settings tests | Export completeness/failures and live CRUD permissions |
| Report generation | No dedicated `adminReports.test.ts` found | Date filters, grouping, CSV formatting, empty output, authorization |

**Do not claim full module coverage from the total test count.** A test suite is a group of tests, not a count of modules. A passed-test percentage is not line/branch coverage, model accuracy, or user acceptance.

### Useful cases to propose or demonstrate

These are a preparation checklist, not a claim they already exist as automated tests.

| ID | Scenario | Expected behavior |
| --- | --- | --- |
| HR-01 | Enter 18 beats | 72 BPM |
| HR-02 | Empty or 0 | Calculation disabled |
| HR-03 | Enter 7, then 8 beats | 28 rejected; 32 accepted |
| HR-04 | Enter 62, then 63 beats | 248 accepted; 252 rejected |
| RT-01 | Tap before signal | Current wait cancelled; no valid attempt added |
| RT-02 | Controlled 280, 310, 310 ms | Average 300 ms |
| RT-03 | Leave during waiting | Pending timeout cleared |
| RES-01 | Scores 35, 36, 60, 61 | Low, Moderate, Moderate, High |
| RES-02 | No inputs | Explicitly assess the current null-to-zero fallback; do not accept it as a real measurement |
| REC-01 | Create as doctor | Issuer ID comes from authenticated identity |
| REC-02 | Patient or unrelated doctor reads | Verify deployed RLS against the approved access design |
| DATA-01 | One export query fails | Errors are disclosed; partial output not called complete backup |
| REP-01 | Cell contains comma or quote | CSV structure remains valid |
| REP-02 | No rows match | Clear no-records message |
| REP-03 | Date-range boundary | Intended local-calendar inclusion/exclusion confirmed |

### Testing types the panel may ask you to distinguish

- **Unit:** does `heartRateStress(75)` return 30?
- **Component:** does the result component show the right category?
- **Integration:** does a saved session reach Supabase and appear to an authorized doctor?
- **System/end-to-end:** does login → assessment → save → web review → export work together?
- **Acceptance:** can intended users complete their tasks and accept the behavior?
- **Performance:** what is the measured response time under stated conditions?
- **Security:** can unauthorized accounts access or modify protected rows, even outside the UI?
- **Model validation:** how well does the actual classifier perform on a representative held-out dataset?

**Why mock the model?** To isolate API parsing and response behavior. Test the actual model separately; mocked predictions cannot establish accuracy.

**Why test invalid inputs?** Real users and clients can submit missing, malformed, boundary, or unauthorized data. Negative tests verify safe failure, not only happy paths.

## 10. Software specifications

### Development software versus user requirements

Developers need build tools; normal end users do not need Node.js, Python, or Android Studio to use a deployed application.

| Software | Role and verified project reference |
| --- | --- |
| React + TypeScript | Web UI, components, typed frontend logic; web manifest declares React 19, TS 4.9 |
| React Native + Expo | Mobile UI/runtime; mobile manifest declares RN 0.88, Expo 58, TS 6 |
| Node.js and npm | Install dependencies and run frontend tooling; mobile engine requires Node ≥22.11.0 |
| Python + Django + DRF | Facial-analysis web API; current backend requirements specify Python 3.12 and Django 5.2.7 |
| Supabase + PostgreSQL | Shared authentication/database architecture |
| NumPy + MediaPipe + OpenCV | Current backend inference runtime, per `mindpulse-backend/requirements.txt` |
| Android SDK/emulator | Android development/testing; see project setup documentation |
| macOS + Xcode | Required for local iOS native development, not for running the web portal |
| Modern browser | Web portal access; test the browser versions you will claim to support |
| Git and an editor | Source control and development workflow, not end-user runtime requirements |

Package versions above are declared project versions, not an assertion that every installed dependency matches them. Use lockfiles and a verified setup for reproducibility.

The README contains older statements saying the face scan is a demo and neither frontend calls Django. Current code contradicts those: `FaceScanCameraScreen.tsx` captures a frame and `emotionScan.ts` sends it to `/api/predict-emotion/`. The README also says Python 3.11+, while current inference requirements explicitly require 3.12. Use the verified current implementation/setup rather than repeating both contradictory versions.

Although training/original artifacts include `.h5` and `.joblib` files, current backend requirements describe exported `.npz` inference using NumPy, plus MediaPipe/OpenCV. Do not automatically claim the deployed backend loads TensorFlow because the original model was trained with it or because a frontend manifest lists TensorFlow.js.

### Likely technology questions

**Why React and React Native?** They allow related component/state concepts and TypeScript across web and mobile while targeting different interfaces. Similarity does not mean both projects automatically share every source file.

**Why Supabase?** It provides shared PostgreSQL storage, authentication, and row-level authorization so both frontends can operate on the same records.

**Why Django as well?** Facial-analysis inference needs a server-side Python runtime. Supabase data services and Python inference have separate responsibilities.

**What is an API?** A defined request/response interface. The mobile scan sends an image to an endpoint and receives an emotion label, confidence, and associated output.

**What is RLS?** Row Level Security is database-side filtering/authorization on rows. A client `.eq()` filter narrows a query but is not by itself a security boundary.

**Is a publishable frontend key a secret?** No. The safety boundary depends on correct authentication and permissions. A service-role secret must never be embedded in the mobile/web client.

**Does this work offline?** Cloud saves/retrieval and server facial analysis require connectivity. Some local screens/calculations can run independently; do not claim an implemented offline synchronization system without evidence.

## 11. Hardware specifications

No benchmarked minimum hardware specification or actual development-device inventory was supplied. The following is a **planning recommendation**, not an experimentally established MindPulse minimum.

| Environment | Practical planning recommendation | Reason |
| --- | --- | --- |
| Development computer | Recent 64-bit multicore CPU, 16 GB RAM, SSD with adequate free space | Web/mobile tooling, Python, browser, and emulator can run together |
| Lighter development setup | 8 GB RAM with a physical Android device; verify before adopting | Avoids much of the emulator's memory cost; not a guaranteed supported minimum |
| Admin/doctor client | Laptop/desktop able to run a supported browser; stable internet | Reads records, renders charts, downloads reports |
| Mobile test device | Supported Android/iOS build target, touchscreen, network access; front camera for scan | Actual supported OS versions must be checked against the verified Expo/native build |
| Facial-analysis server | CPU/RAM sufficient for model load and concurrent requests, verified by measurement | No defensible capacity figure can be inferred from source code alone |
| Consultation accessories | Working camera, microphone, speaker/headset if demonstrating calls | Needed for consultation, not for manual pulse counting or reaction timing |

**Heart-rate module:** requires the user's pulse count and app timer, not a special sensor.

**Reaction module:** requires a touchscreen; hardware/rendering latency can affect results.

**Report module:** requires access to browser download/storage, not a printer.

**GPU:** do not claim a dedicated GPU is required. Current backend runtime is CPU-oriented; performance and deployment suitability still require measurement.

For your manuscript, distinguish three tables if possible:

1. **Actual development equipment:** exact CPU, RAM, OS, storage, and devices you really used.
2. **Actually tested client equipment:** device model, OS/build, browser/app version, and results.
3. **Recommended equipment:** clearly labeled recommendations, with rationale.

Suggested truthful format: “We developed and demonstrated the system using [actual CPU], [actual RAM], [actual OS], and [actual phone/OS]. The following hardware is recommended for development. We have not yet established minimum supported hardware through systematic testing.”

If asked “Why 16 GB RAM?”, answer that it is a development-workload recommendation because emulators and multiple services consume memory—not a measured requirement for viewing one web page.

## 12. Pre-defense issues to reconcile

Prioritize these before making strong completion/security claims:

1. **Recommendation role wording:** User Create/Retrieve in the signed list versus self-care tips, internal clinician records, and published notes in the implementation.
2. **Recommendation confidentiality:** SQL still allows the subject student to SELECT their clinician recommendation rows; hiding the mobile screen does not revoke that permission.
3. **Admin deletion:** SQL still has an admin DELETE policy on `stress_sessions`, despite a no-admin-purge design narrative.
4. **Review metadata:** migration 0030 restricts columns, but earlier self/admin row policies remain. Avoid claiming doctor-exclusive review updates without full verification.
5. **Current testing:** two mobile screen tests fail in this environment. Existing `docs/unit-testing.md` reports older totals; do not reuse them as today's result.
6. **Test gaps:** dedicated heart-rate/reaction interaction, recommendation, export, and report tests were not found. Show manual/integration evidence separately if you have it.
7. **Clinical claims:** locate the actual methodology support for weights, categories, reaction interpretation, and facial mapping. Do not substitute passing software tests for validation.
8. **No-input result:** the screen substitutes zero when fusion returns null. Verify the workflow blocks an empty submission or address it before calling it a valid low result.
9. **Data export:** do not call the six-table, non-paginated JSON download a complete backup.
10. **Local settings:** distinguish browser preferences/frontend checks from globally enforced server settings.
11. **Real deployment:** confirm migrations are applied and test actual account permissions with separate roles. Repository SQL alone does not reveal the live database state.
12. **Documentation:** reconcile the obsolete README face-scan/backend/runtime statements with the current code.

These are preparation findings, not changes made to your application. Do not tell the panel that an issue has been fixed merely because it is documented here.

## 13. Short answers to rehearse

**“What exactly was your contribution?”**

> My assigned scope covers input collection for manual heart rate and reaction time, presenting results, guidance-related workflows, and administrative data/report functions. I can trace each from its screen to its service and database operation. I distinguish my assigned responsibility from other team members' implementation; I will only claim code I actually contributed.

**“Where is your most important code?”**

> HeartRateEntryScreen handles beats-to-BPM conversion, ReactionGameScreen handles timing and the three-round state machine, stressFormula contains the weighted transforms, dashboard saves assessment sessions, recommendations handles clinician records, dataExport builds JSON exports, and adminReports builds CSV reports.

**“What happens if the internet fails?”**

> Local interaction may continue, but cloud writes and server analysis can fail. The relevant service returns an error; we should not say a result is saved until the database confirms it. We do not claim full offline synchronization.

**“Can doctors read all patients?”**

> The assessment SELECT policy is designed to allow the owner, an admin, or an account with the implemented appointment link. We must verify deployed policies using separate test accounts, including an unrelated doctor.

**“Is it secure because the buttons are hidden?”**

> No. The UI guides users, but authorization must be enforced by database/server permissions. We test unauthorized requests directly, not only navigation.

**“All tests pass, so the system is accurate?”**

> No. Passing tests establish only the behaviors asserted in those tests. Real model accuracy, measurement reliability, access control, and user acceptance need their own evidence. In the latest run here, two mobile screen tests also still fail because of test-environment resolution.

**“Is it a medical diagnostic system?”**

> We present it as an awareness/support prototype with limitations and professional referral paths, not a substitute for clinical assessment.

**“Why didn't you implement every CRUD operation?”**

> CRUD depends on the entity and role. Results are primarily retrieved, draft measurements can be retaken, and reports are generated on demand. Where that differs from the signed module list, we need an explicit approved revision rather than silently redefining the requirement.

## 14. Suggested demonstration and study plan

### Demonstration order

1. State your six modules and role boundaries.
2. On the phone, demonstrate the pulse timer and show 18 beats becoming 72 BPM.
3. Demonstrate an early reaction tap, then three valid rounds and the average.
4. Show the result, explain one worked weighted-score example, and save.
5. Reopen the saved record in patient history; use an authorized web account to retrieve it.
6. Show system self-care guidance separately from a doctor's recommendation and published note.
7. Export one filtered CSV report and explain its columns.
8. Show the JSON export separately and explain why it is not a full backup.
9. Open one real test file, identify Arrange/Act/Assert, and show the current run summary truthfully.

Use demonstration accounts and non-sensitive data. Do not expose patient information, passwords, service-role secrets, or private configuration during screen sharing. Test the actual phone/network and wake the inference service before the demonstration; never replace a live failure with an undisclosed fabricated result.

### Study in four passes

1. **Understand:** explain each module without opening the editor.
2. **Trace:** locate the screen → service → database table or file output.
3. **Calculate:** solve the BPM, reaction average, and weighted-score examples by hand.
4. **Defend:** practice limitations, permission differences, failed tests, and proposed improvements without claiming unverified fixes.

Use this response pattern when surprised:

> Purpose → implemented mechanism → code evidence → limitation.

For example: “The reaction test captures response time. It timestamps a randomized signal and averages three valid taps. The logic is in ReactionGameScreen. Device latency can affect the reading, so we do not treat it as a clinical diagnostic measurement.”

The goal is not to memorize every line. Be able to explain **what the module does, who may use it, how the value moves through the system, why the code is written that way, and what the evidence does not prove**.
