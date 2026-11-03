# Module Implementation Status & Design Decisions

**System:** MINDPULSE: AI-Based Emotional Stress Detection System Using Facial Analysis
**Spec of record:** `List of Modules Adviser Signature.pdf` — 24 modules, adviser-signed
**Audit date:** 2026-10-31 (read-only code audit, no code changed)
**Status:** Phase 0 of the remediation sequence — *pending review sign-off (Appendix D)*

---

## 1. Purpose

This document reconciles every CRUD operation × role cell in the signed List of Modules
against what is actually implemented in the codebase, and records the decision for each
gap:

| Decision | Meaning |
|---|---|
| **Fix** | A real defect: the system already claims this behaviour but does not deliver it (Appendix A) |
| **Build (lean)** | A realistic, low-risk feature that should exist anyway (Appendix B) |
| **Deviate** | The spec cell is intentionally not implemented, for a documented safety/privacy/professional reason (Appendix C) |

Nothing is implemented "because the PDF says so", and nothing is dropped without a
written reason. Each Appendix C deviation requires a reviewer initial before the module
may be reported as *covered*.

---

## 2. Legend (used in the per-module registers)

| Glyph | Meaning |
|---|---|
| ✅ | Implemented and working |
| 🔁 | *Implemented-as* — delivered in a different, justified form (see notes) |
| 🔧 | Planned — committed fix/build (Appendix A or B) |
| 🔶 | Optional — build only if the adviser requires the cell |
| ⛔ | Deliberate deviation (Appendix C reference) |
| ❌ | Open gap / defect |
| — | Not required by the spec |

Roles: **Admin** and **Doctor** use the web app; **User** (patient) uses the mobile app.

---

## 3. Summary

| Code audit status | Count | Modules |
|---|---|---|
| Fully implemented | 7 | Result Display, Stress History, Admin Dashboard, User Monitoring, Report Generation, MindPlant Growth & Streak, Security & Access Control |
| Partially implemented | 15 | User Authentication, User Profile Management, User Health Background, Assessment Session, Survey Assessment, Heart Rate Input, Reaction Time Test, Facial Analysis, Stress Calculation, Recommendation, Consultation Request, Consultation Management, Messaging, Notification, Data Management |
| Not implemented | 2 | Consent Management, Activity Log |

**Target end-state after this sequence:** all 24 modules *covered* — implemented,
implemented-as, or deviating with an approved justification.

---

## 4. Decision principles

1. **Three buckets.** Every gap is a defect (fix), a realistic gap (build lean), or an
   unrealistic spec cell (deviate with a reason).
2. **Clinical data is immutable.** No hard delete of sessions, results, messages, or
   consent. Correction happens *before* submission (retake), or through soft states
   (`cancelled`, `withdrawn`, `anonymized`, `draft`/`published`).
3. **Deletion is least-privilege.** Patients delete their own account (self-service,
   already built). Admins remove unapproved staff accounts. Clinicians never delete
   patient records.
4. **No fake controls.** A toggle that only writes to `localStorage` is removed, not
   preserved. If it cannot be enforced server-side, it does not ship.
5. **Additive schema only.** New tables and nullable columns with defaults. No ALTERs
   that change existing column semantics; no destructive migration.
6. **RLS-first.** Every new table ships with row-level security and explicit policies;
   capture that cannot be bypassed by the client (database triggers, per the existing
   `0008_notification_events.sql` pattern).

### Approved precedents

| Precedent | Effect |
|---|---|
| Licensed doctor's guidance: **clinical recommendations must not be visible to patients** | Patient-facing channels are the *published consultation progress note* (`setPatientNotePublication`, `ConsultationSummaryView` publish switch, migration `0021_therapy_progress_note.sql`) and system-authored self-care tips (`SelfCareModal`). Recommendation cells for the User role → deviation **C-6**. |
| `0008_notification_events.sql` | Notifications are created by database triggers fired by admin/doctor/patient actions — the basis for deviation **C-10** and the model for the Activity Log build (B-4). |
| `delete_my_account()` / `delete_app_user()` RPCs (`0001_canonical_schema.sql`) | Patient deletion is user-initiated; admin deletion applies to staff accounts → deviations **C-1/C-2**. |

---

## 5. Per-module registers

Cell notation: `Operation → Admin / Doctor / User`.

### M-01 · User Authentication — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | — | — | ✅ `AuthScreen.signUp`, `WebAuth.signUp` + `profiles` trigger |
| Retrieve | ✅ `session.ts` role routing | ✅ | ✅ |
| Update | ✅ own credentials (`AdminProfileSettingsView`, `ProfileSecurityPanel`) | ✅ own credentials | ✅ password/metadata (`AccountInfoModal`) |
| Delete | 🔁 staff accounts only (`delete_app_user` via Deny/Remove) — **C-2** | ⛔ — **C-1** | 🔁 self-service `delete_my_account` |

**Decision:** complete once **C-1** is approved. No code work.

### M-02 · User Profile Management — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | — | — | ✅ sign-up trigger |
| Retrieve | ✅ `fetchAdminAccounts` (view-only modal) | ✅ `studentCases.ts` | ✅ `PatientProfileScreen` |
| Update | 🔶 edit other users' profiles — not built (**C-3**) | ✅ own profile | ✅ `AccountInfoModal` |
| Delete | ⛔ patients not admin-deletable — **C-1/C-2** | — | — |

**Decision:** deviate on Delete; **C-3** is optional Bucket B if the adviser wants admin
correction of contact fields.

### M-03 · User Health Background — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | — | — | ✅ `HealthSetupScreen` → `profiles.mental_conditions` / `physical_conditions` |
| Retrieve | — | ✅ case-detail **Health Background** panel (**B-1 built**, 2026-11-03) | ✅ profile + dashboard |
| Update | — | — | ✅ re-run health setup |
| Delete | — | — | 🔁 clear-all by re-run; no history table to purge |

**Decision:** **B-1 delivered** (2026-11-03) — `mental_conditions`/`physical_conditions`
added to the shared case select (`PROFILE_COLUMNS`) and rendered as read-only chips on the
case detail Overview tab. RLS check passed as written: `profiles` SELECT is a table-level
grant (`0001` §12b) with a row-level policy only, so a doctor already linked by
appointment reads the whole row — no migration needed.

### M-04 · Consent Management — *audit: Not implemented*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | — | — | 🔧 **B-3** (signup + face-scan consent modal currently persist nothing) |
| Retrieve | 🔧 **B-3** read-only register | 🔶 | 🔁 own consent shown in Privacy/About |
| Update | 🔁 withdrawal recorded as a new state, never an edit | — | 🔁 |
| Delete | ⛔ proof of consent must outlive the account — **C-14** | — | — |

**Decision:** build lean (**B-3**): `consent_records(user_id, consent_type, version,
granted_at, withdrawn_at, source)`, written at registration and at the existing
*"I Understand & Continue"* button (`FaceScanInstructionsScreen.tsx:337-343`). Deviate on
Delete.

### M-05 · Assessment Session — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | — | — | ✅ `AssessmentResultScreen.handleSaveResult` → `stress_sessions` |
| Retrieve | ✅ `fetchAdminResults` | ✅ RLS-scoped + case detail | ✅ dashboard/history |
| Update | ⛔ — **C-4** | ✅ *Mark as Reviewed* persists via `reviewed_at` (**A-3 fixed**, migration `0030`; only review columns are client-writable) | ⛔ correct by retaking before save — **C-4** |
| Delete | ⛔ — **C-4** | — | — |

**Decision:** deviate on update/delete (clinical immutability); **A-3 fixed** — the
doctor's *Mark as Reviewed* now writes `reviewed_at`/`reviewed_by` through a
column-restricted grant and an appointment-linked RLS policy (migration `0030`), with an
optimistic UI that rolls back on rejection.

### M-06 · Survey Assessment — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | ✅ tool CRUD (`assessmentTools.ts`) | — | ✅ PSS-10 + `survey_answers` (0019) |
| Retrieve | 🔶 item-level answers (title only today) | ✅ per-item in case detail | ✅ via session modal |
| Update | ✅ edit tool | — | ⛔ answers immutable — **C-4** |
| Delete | ✅ delete tool | — | — |

**Defects → ✅ fixed (A-4 + A-10, 2026-11-02):** admin-created supplementary tools now
have a real entry point — the hub lists published non-Multi-Modal tools under "More
Assessments" and routes them into the already-built `ToolSurveyScreen`, which scores and
saves a session (0019). **A-10:** the PSS-10 is declared **version-locked** — patients
answer the app's built-in translated items (en/fil/ceb), so the admin form hides the
questions editor for Multi-Modal tools and explains why (custom questions belong to
supplementary tools). The Multi-Modal tool stays filtered out of the new list to avoid a
second entry point to the same work.

### M-07 · Heart Rate Input — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | — | — | ✅ `HeartRateEntryScreen` (beats × 4), saved with the session |
| Retrieve | ✅ | ✅ | ✅ |
| Update | — | — | 🔁 re-run the timer before submitting — **C-4** |
| Delete | ⛔ — **C-4** | — | — |

**Decision:** deviate. No standalone HR record exists by design — the reading belongs to
a session.

### M-08 · Reaction Time Test — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | — | — | ✅ 3-round test; ✅ standalone flow now persists `reaction_time_ms` (**A-2 fixed**) |
| Retrieve | ✅ | ✅ | ✅ |
| Update | — | — | 🔁 retake before submitting — **C-4** |
| Delete | ⛔ — **C-4** | — | — |

**Decision:** deviate on update/delete; **A-2 fixed** — `handleFinalResultsDone` now
forwards `reactionResult.average` the same way it already forwards `heartRateBpm`.

### M-09 · Facial Analysis — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | — | — | ✅ hub flow; ✅ standalone demo removed — **A-9 fixed** (it was already unreachable) |
| Retrieve | ✅ `emotion` now written with each session (**A-1 fixed**) → filters/ component stats read real labels; rows saved before the fix stay `NULL` | ✅ same | ✅ confidence |
| Update | — | — | — |
| Delete | ⛔ no scan artifacts stored at all (stateless inference) — **C-4** | — | — |

**Decision:** **A-1 fixed** (emotion is now saved with the session). **A-9 fixed** — the
standalone non-persisting demo turned out to be already unreachable (dead `onRunFaceScan`
prop; the dashboard CTA navigates to the analysis tab), so its wiring was deleted; the
persisting hub flow is the only face-scan path. Deviate on delete: images and landmarks
are never stored, which is also what the in-app Privacy Policy promises.

### M-10 · Stress Calculation — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | 🔁 admin authors tool content; weights are fixed algorithm constants — **C-13** | — | ✅ score computed client-side |
| Retrieve | ✅ | ✅ | ✅ |
| Update | ⛔ weights not admin-editable — **C-13** | — | — |
| Delete | — | — | — |

**Defect → ✅ fixed (A-6, 2026-11-02):** three divergent formulas (mobile fusion vs
`FinalStressScoreScreen` vs `assessmentOutcomes.ts`) meant admin component bars did not
reflect how scores were computed. The hub fusion — canonical because it writes the
stored `score` — is now the single source of truth: `mindpulse-mobile/src/services/stressFormula.ts`
owns the transforms and weights; the hub, `FinalStressScoreScreen` (its `|bpm−70|×1.5`
+ 40/60 blend replaced by the canonical HR+reaction renormalized weights, and the dead
`ReactionResult.score` removed) and the web component bars all derive from it. Stored
scores stay authoritative — history is never re-computed.

### M-11 · Result Display — *audit: Fully implemented*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Retrieve | ✅ | ✅ | ✅ `AssessmentResultScreen` / `FinalStressScoreScreen` |
| Update | ⛔ results are read-only — **C-5** | — | — |

**Decision:** complete pending **C-5**.

### M-12 · Stress History — *audit: Fully implemented*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Retrieve | ✅ `AdminRecordsView` history modal | ✅ case detail | ✅ History segment + `SessionDetailModal` |
| Update | ⛔ — **C-5** | — | — |
| Delete | ⛔ — **C-5** | — | ✅ bulk erase own history (`PrivacyDataModal`) |

**Decision:** complete pending **C-5**.

### M-13 · Recommendation — *audit: Partial* *(guided by clinical consultation)*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | ⛔ admin is not the treating clinician — **C-7** | ✅ `StudentCaseDetailView` | 🔁 self-care tips are system-authored (`SelfCareModal`) |
| Retrieve | 🔶 read-only if adviser requires — **C-7** | ✅ `fetchDoctorRecommendations` | ⛔ **C-6** (per doctor's guidance) → patient reads *published* progress notes + self-care tips |
| Update | ⛔ — **C-7** | ✅ mark completed | — |
| Delete | — | ✅ *Remove* action wired to `deleteRecommendation` (**A-7 fixed**, RLS already allowed it) | — |

**Decision:** deviate **C-6/C-7** with the doctor's guidance cited; **A-7 fixed** (the dead `deleteRecommendation` is now wired as a *Remove* action for the issuing doctor).

### M-14 · Consultation Request — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | ⛔ bookings are patient-initiated or doctor walk-in desk — **C-11** | 🔁 walk-in booking | ✅ `saveBookedAppointment` + payment |
| Retrieve | ✅ consultation records | ✅ | ✅ `fetchMyBookings` |
| Update | ⛔ — **C-11** | ✅ approve / decline / reschedule | 🔶 own cancel (status → `cancelled`) — **B-6** |
| Delete | 🔶 admin cancel no-show — **B-6** | 🔁 decline = `cancelled`, never a row delete | — |

**Decision:** deviate on admin create/update; optional patient-cancel and admin-cancel as
status changes (B-6).

### M-15 · Consultation Management — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | ⛔ oversight role, not operator — **C-11** | ✅ schedule / walk-in | — |
| Retrieve | ✅ `AdminRecordsView` | ✅ `ConsultationsView` | ✅ bookings + summaries |
| Update | ⛔ — **C-11** | ✅ lifecycle, notes, video, payments | 🔶 — **B-6** |
| Delete | ⛔ — **C-11** | 🔁 decline/cancel status only | — |

**Decision:** deviate on admin operator cells; doctor side is complete.

### M-16 · Messaging — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | — | ✅ `sendWebChatMessage` | ✅ `sendChatMessage` |
| Retrieve | ⛔ admin does not read clinical correspondence — **C-8** | ✅ threads + read receipts | ✅ |
| Update | — | — | — |
| Delete | ⛔ chat records retained — **C-9** | ⛔ — **C-9** | ⛔ — **C-9** |

**Decision:** deviate **C-8/C-9** — same privacy reasoning as **C-6**. The
patient↔doctor channel itself is fully implemented (realtime, attachments, read receipts).

### M-17 · Notification — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | 🔁 event-driven via `0008` triggers fired by admin/doctor actions — **C-10** | 🔁 — **C-10** | 🔁 (assessment completion) |
| Retrieve | ✅ `AdminNotificationsView` | ✅ `NotificationHistorySheet` | ✅ `PatientNotifications` |
| Update | ✅ mark one / mark all read | ✅ | ✅ |
| Delete | ✅ dismiss-from-my-list (delete own row) — **B-2 built** | ✅ — **B-2 built** | ✅ — **B-2 built** |

**Decision:** **B-2 delivered** (2026-11-03) — `dismissFeedNotification` (web) /
`dismissNotification` (mobile) delete the row pinned to `user_id`; RLS `notifications_delete`
already allowed it. Wired into the admin notification cards, the doctor history sheet (row ✕
and detail-pane Dismiss) and both mobile bells, each with optimistic removal + rollback.
Compose-by-hand stays out (**C-10**).

### M-18 · Admin Dashboard — *audit: Fully implemented*

| Operation | Admin |
|---|---|
| Retrieve | ✅ `fetchAdminOverview` / `fetchAdminDashboardCharts` (live data) |
| Update | ✅ applied settings (system name, theme, session timeout) |

**Decision:** complete. Cosmetic settings tabs were cut under **A-5 (fixed)**, which
*shrinks* this page to only what is real: system name, theme/density, high-stress alert
gating, session timeout, password policy and data export.

### M-19 · User Monitoring — *audit: Fully implemented*

| Operation | Admin |
|---|---|
| Retrieve | ✅ accounts list, records, at-risk, per-patient history |
| Update | ✅ approve / verify / unverify |
| Delete | 🔁 staff accounts only — **C-1/C-2** |

**Decision:** complete pending **C-1/C-2**.

### M-20 · Data Management — *audit: Partial*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | ✅ JSON export (`dataExport.ts`) | — | — |
| Retrieve | ✅ | ✅ records views | — |
| Update | 🔁 applied settings only (system name, theme, session timeout, password policy) — unenforceable retention/anonymize/GDPR/2FA/whitelist toggles removed (**A-5 fixed**) | — | — |
| Delete | 🔁 pending-staff removal + user self-service — **C-1/C-2**; ⛔ no admin record purge | — | ✅ erase history / delete account |

**Decision:** **A-5 fixed** (controls that enforce nothing were removed; only enforced
settings remain). Deviate on admin purge.

### M-21 · Security and Access Control — *audit: Fully implemented*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create | ✅ MFA enrollment (`ProfileSecurityPanel`) | ✅ same | 🔁 credentials at sign-up; mobile has password change only |
| Retrieve | ✅ active sessions (`0026`), verification codes (`0027`) | ✅ | ✅ own security panel |
| Update | ✅ password / MFA / session timeout | ✅ | ✅ |
| Delete | 🔁 removes staff access; 🔶 revoke another user's sessions (**B-6**) | — | — |

**Decision:** complete. Optional **B-6** only if the adviser wants admin-side session
revocation for patients.

### M-22 · Report Generation — *audit: Fully implemented*

| Operation | Admin | Doctor |
|---|---|---|
| Create | ✅ 5 CSV reports (`adminReports.ts`) + analytics export | ✅ CSV exports in results/cases/transactions |
| Retrieve | ✅ | ✅ |
| Update | ⛔ generated on demand, nothing stored — **C-12** | — |
| Delete | ⛔ — **C-12** | — |

**Decision:** complete pending **C-12** (no report repository exists to edit or delete).

### M-23 · Activity Log — *audit: Not implemented*

| Operation | Admin | Doctor |
|---|---|---|
| Create | 🔧 **B-4** (database triggers) | — |
| Retrieve | 🔧 **B-4** admin read-only view | 🔶 |
| Update / Delete | — | — |

**Decision:** build lean (**B-4**): `activity_log(actor, action, entity, entity_id,
created_at)` written by triggers on `profiles`, `appointments`, `stress_sessions`,
`consultation_notes` — mirrors `0008`, cannot be bypassed by the client, requires no
changes to existing screens for capture.

### M-24 · MindPlant Growth and Streak — *audit: Fully implemented*

| Operation | Admin | Doctor | User |
|---|---|---|---|
| Create / Retrieve / Update | — | — | ✅ `plantProgress.ts` upsert + read, `streakLogic.ts` (unit-tested), `0011`/`0020` |
| Delete | — | — | — |

**Decision:** complete. Row deletion is by design absent — a plant only lapses through
missed days.

---

## Appendix A · Defect fixes (Bucket A — do first, no schema change unless noted)

| # | Defect | Location | Fix |
|---|---|---|---|
| A-1 | Detected emotion never persisted → admin/doctor emotion filters and facial component stats are empty | `mindpulse-mobile/src/services/dashboard.ts` `saveNewStressSession` insert list; `mindpulse-web/src/services/assessmentOutcomes.ts` label map | Write `emotion` with the session; align `EMOTION_STRESS` to the model's real labels (Happy/Neutral/Sad) |
| A-2 | Standalone flow drops `reaction_time_ms` (survives only inside free-text notes) | `mindpulse-mobile/App.tsx` `handleFinalResultsDone` (passes 3 args) | Forward `reactionTimeMs` the way `heartRateBpm` already is |
| A-3 | Doctor "Mark as Reviewed" is component-local state — a fake Update | `mindpulse-web/src/views/doctor/AssessmentResultsView.tsx:58` | Persist via nullable `reviewed_at` (small migration, B-5) **or** remove the control |
| A-4 | Admin-created supplementary survey tools can never be taken | `StressAssessmentHubScreen.tsx` step list; dead `'ToolSurvey'` route in `AssessmentNavigator.tsx:75` | Wire an entry point **or** scope the admin form to the multi-modal tool only |
| A-5 | Admin System Settings: retention, anonymize, GDPR, 2FA, IP whitelist, API key = `localStorage`-only | `AdminSystemSettingsView.tsx`, `services/adminSettings.ts` | Remove unenforceable controls; keep only what is real (system name, theme, session timeout, export) |
| A-6 | Three divergent stress formulas — admin component bars ≠ how scores were computed | `AssessmentResultScreen.tsx` fusion vs `FinalStressScoreScreen.tsx` vs `assessmentOutcomes.ts` | One source of truth; stored score stays authoritative |
| A-7 | `deleteRecommendation` is dead code (no caller) | `mindpulse-web/src/services/recommendations.ts:145` | Wire it for the doctor, or delete it |
| A-8 | At-risk phone hardcoded `null` with a stale comment (`profiles.phone` exists and is read elsewhere) | `mindpulse-web/src/services/adminRecords.ts:211-212` | Populate the column or remove the Call affordance |
| A-9 | Standalone face scan is an explicit non-persisting demo, but is reachable from dashboard CTAs | `mindpulse-mobile/App.tsx` ~539-543 | Persist like the hub flow, or remove the CTA and keep hub-only |
| A-10 | Survey question source drift (DB rewritten by `0018`, mobile text hardcoded in i18n) | `mindpulse-mobile/src/i18n/translations.ts`, `assessment_tools` | Decide with the adviser: render from DB **or** declare PSS-10 version-locked (pair with A-4) |
| A-11 | *Reported at runtime:* stress survey white-screens with "Cannot read property 'options' of undefined" when Part 2 renders with a stale/undefined question — the patient loses all in-progress answers | `mindpulse-mobile/src/screens/survey/StressSurveyScreen.tsx:49`; `src/i18n/translations.ts` | Clamp the question index onto the list; optional-chain every `currentQuestion` access; drop empty locale slots in `part1Display`/`part2Display`; replace the `findIndex !== -1` label lookup (crashed on a question without `options`); full-survey regression test |

**Fix log**

| Status | Items | Verification |
|---|---|---|
| ✅ Fixed 2026-10-31 | **A-1, A-2, A-7, A-8** — `emotion` now written with every session (hub flow), standalone flow now persists `reaction_time_ms`, doctor's *Remove recommendation* wired to `deleteRecommendation` (RLS `recommendations_delete` already allowed it), at-risk `phone` now reads `profiles.phone` so the Call action dials a real number | Web `tsc --noEmit` clean; web 97/97 tests (15 suites); mobile 51/51 tests (5 suites). Mobile's raw `tsc` baseline was already failing on pre-existing RN/Expo typing issues (`StatusBar.backgroundColor`, `ScrollView` refs, missing `@types/jest`) — no new errors in any changed file. *Note: `emotion` is populated for sessions saved from now on; rows written before this fix stay `NULL` until resubmitted.* |
| ✅ Fixed 2026-10-31 | **A-5** — System Settings now only models settings that real code enforces. Removed: whole `detection` tab (sensitivity/confidence/model-version/scan-interval/real-time/multi-face), retention, anonymize, *store facial images*(!), GDPR toggle, performance/daily-summary alerts, primary e-mail, notification frequency, 2FA, IP whitelist, mock API-key row. Kept: system name/description, theme + density, high-stress alert gating, session timeout, password policy, data export. `loadAdminSettings` now picks known keys only, so legacy localStorage payloads load cleanly without reviving removed fields (covered by a new test case) | Web `tsc --noEmit` clean; full web suite 97/97 (15 suites) |
| ✅ Fixed 2026-11-01 | **A-11** — reported by a teammate's build: the PSS-10 survey white-screens entering Part 2. This copy's logic was verified sound (Part-2 entry has always reset the index; en/fil/ceb all ship the complete 10/8/5 item sets), so the failing build is divergent or a stale Metro bundle — but the screen is now crash-proof regardless of cause: index clamp, `?.` on every `currentQuestion` access, `definedOnly()` filtering in the display helpers, and a direct `options?.[value]` label lookup. New regression test (`StressSurveyScreen.test.tsx`) walks Part 1 → interstitial → Part 2 → completion; validated to FAIL when the index reset is deliberately removed (renders q108 instead of q101 — degraded, not crashed) and PASS on HEAD. Also repaired a toolchain skew exposed by the test: `@react-native/jest-preset` 0.86.3 → 0.88.1 to match `react-native@0.88.0` (RN 0.88's internals import `react-native/react-private-interface`, unresolvable under the 0.86 preset's module mapper — this is why screen rendering previously could not run under jest) | Mobile jest **6/6 suites, 52/52 tests**; `StressSurveyScreen.tsx` + `translations.ts` compile clean (test-file `jest`/`expect` name errors are the pre-existing `@types/jest` baseline shared by all six test files) |
| ✅ Fixed 2026-11-01 | **A-3** — "Mark as Reviewed" now persists. Migration `0030_assessment_review_flags.sql` adds nullable `reviewed_at`/`reviewed_by`, revokes client UPDATE on every other column of `stress_sessions` (server-enforcing deviation C-4 — nothing in either app or any trigger updated those columns), and adds an `stress_sessions_update_review` RLS policy limited to appointment-linked doctors. `AdminResultRow` carries `reviewedAt`; new `setResultReviewed()` writes it; the doctor's view uses optimistic flip + rollback and derives the Reviewed summary from real rows | Web `tsc --noEmit` clean; web 97/97 tests (15 suites). **Note: migration `0030` must be applied to Supabase before this path works in a live environment** (until then the write is rejected by RLS and the UI rolls back with an error message — no crash) |
| ✅ Fixed 2026-11-02 | **A-6** — one canonical stress formula. New `mindpulse-mobile/src/services/stressFormula.ts` extracts the hub fusion (the writer of the stored `score`), so `AssessmentResultScreen` calls it with identical arithmetic → saved scores unchanged; `FinalStressScoreScreen` switched from `|bpm−70|×1.5` + a 40/60 blend to the canonical HR+reaction weights renormalized over those two indicators (⅔ · ⅓ — the fusion-card title now states the real split); the dead second mapping `ReactionResult.score` (`(avg−150)/4`, single consumer) was deleted at the source; web `assessmentOutcomes.ts` mirrors the canonical transforms (legacy `EMOTION_STRESS` map → happy/neutral/sad + confidence pull, HR baseline 55 → 60 bpm, reaction `ms/2000` → `(ms−250)/3`) with bar maxes 50/20/20/10 = weights ×100 | Web `tsc` clean + 97/97 tests (15 suites); mobile jest **7/7 suites, 61/61 tests** including new `stressFormula.test.ts` contract tests (baselines, clamps, confidence pull, weight renormalization); changed files compile clean apart from pre-existing baselines |
| ✅ Fixed 2026-11-02 | **A-9** — the non-persisting standalone face scan turned out to be *already unreachable*: the dashboard's "Face Scan" quick action navigates to the analysis tab, and the `onRunFaceScan` prop App.tsx passed was never called anywhere. Deleted the dead wiring (prop threading in `PatientDashboardScreen` + App.tsx, the `screenMode === 'faceScan'` render/back-handling blocks, the union member, the unused import). The persisting hub flow is now the only face-scan path — no fake feature remains reachable | Mobile jest green (8 suites / 62 tests); changed files compile clean apart from pre-existing baselines (verified: the `App.tsx` StatusBar error exists on HEAD) |
| ✅ Fixed 2026-11-02 | **A-4** — admin-published supplementary tools are takeable. The hub lists active non-Multi-Modal tools under "More Assessments" (new i18n section title/note/duration unit in en/fil/ceb + `types.ts`) and routes each card into the already-built `ToolSurveyScreen`, which scores (`scoreToolAnswers`), saves a session (0019) and records completion. The Multi-Modal tool is filtered out — listing it would recreate the duplicate entry point the original tool list was removed for (rationale preserved in a hub comment). New `StressAssessmentHubScreen.test.tsx` guards both properties: the card fires `onNavigate('ToolSurvey', tool)` and the Multi-Modal title never appears; validated by failing when the filter is deliberately removed | Mobile jest **8/8 suites, 62/62 tests** |
| ✅ Fixed 2026-11-02 | **A-10** — PSS-10 declared **version-locked** (adviser ruling, paired with A-4): patients answer the app's built-in translated items (en/fil/ceb), so the admin form hides the questions editor for Multi-Modal tools, states why, and `saveTool` no longer requires questions for that category (it carries none). Custom patient-facing questions live in Supplementary/Brief tools, which A-4 made real. Recorded as deviation **C-15** | Web `tsc --noEmit` clean + 97/97 tests (15 suites) |
| 🎉 Phase 1 complete | **A-1 … A-11 all fixed** (2026-10-31 → 2026-11-02). Next: Phase 2 lean builds (B-1 doctor health-background read, B-2 notification dismiss) → Phase 3 additive migration (B-3 consent table, B-4 activity log) → Phase 4 optional adviser-driven items (B-6) | — |
| 🎉 Phase 2 complete | **B-1 + B-2 built** (2026-11-03). **B-1:** case select gains `mental_conditions`/`physical_conditions` (single-literal `PROFILE_COLUMNS` so Supabase's select parser keeps its row type) and the case detail Overview shows a read-only *Health Background* panel (chips + "None recorded"); no migration — RLS verified as table-level SELECT grant with row-level policy. **B-2:** `dismissFeedNotification` / `dismissNotification` delete own rows pinned to `user_id`, wired into the admin notification cards, the doctor history sheet (row ✕ + detail-pane Dismiss) and both mobile bells (patient + doctor), all optimistic with rollback; badge/counts follow the row. Tests: DoctorChrome row queries narrowed to the row opener (the dismiss label also contains the title). Next: Phase 3 additive migration (B-3 consent table, B-4 activity log) → Phase 4 optional adviser-driven items (B-6) | Web `tsc --noEmit` clean + **111/111 tests (16 suites)** incl. 3 new B-2 cases (admin dismiss, failed-dismiss rollback, doctor sheet dismiss); mobile jest **65/65 tests (9 suites)** incl. new `notifications.test.ts` (delete pinned to `user_id`, DB error surfaced, no session → no delete); mobile `tsc --noEmit` clean |

## Appendix B · Lean builds (Bucket B — sequenced)

| # | Build | Depends on | Notes |
|---|---|---|---|
| B-1 | Doctor reads health background in case detail | Verify RLS on `profiles` | ✅ **delivered 2026-11-03** — 2 columns added to the existing case select; Overview panel renders them as read-only chips (no migration: table-level SELECT grant + row-level policy) |
| B-2 | Notification dismiss (delete own row) | — | ✅ **delivered 2026-11-03** — mobile + web service deletes pinned to `user_id`; dismiss wired into admin cards, doctor history sheet and both mobile bells (optimistic + rollback). Satisfies the Delete cells realistically |
| B-3 | Consent records table + writes at sign-up and face-scan consent + admin read-only view | Migration | Closes the only *fully* missing user-data module |
| B-4 | Activity log table via DB triggers + admin read-only view | Migration (after B-3, same additive batch) | Follows `0008` pattern |
| B-5 | `reviewed_at` persistence | ✅ delivered with A-3 (migration `0030`, 2026-11-01) | Additive nullable columns + column-level grant |
| B-6 | Optional, adviser-driven: patient cancels own booking (status change), admin cancels no-show, admin read of recommendations, mobile MFA panel, admin item-level survey answers, admin contact-field correction (C-3) | Adviser decision | Each is status-change or read-only — no new deletion paths |

## Appendix C · Deviation log (require reviewer initials)

| # | Deviation | Rationale |
|---|---|---|
| C-1 | Clinicians (doctor role) cannot delete patient records | No clinical system permits clinician-side destruction of patient records; retention and medico-legal duty |
| C-2 | Admin deletion applies to staff accounts only; patient deletion is user self-service | Account erasure is the data subject's right and action (`delete_my_account`), not an operator shortcut |
| C-3 | Admin does not edit patient identity fields (view-only) | Identity corrections are requested from the user; optional build B-6 if required |
| C-4 | Submitted assessment, survey, heart-rate and reaction data are immutable; correction = retake before submission | Clinical record integrity; prevents post-hoc score editing |
| C-5 | Results and history are read-only for staff | Same as C-4; bulk erasure is available to the data subject only |
| C-6 | **Patients do not see clinician-authored recommendations** | Licensed doctor's guidance; patient channels are published consultation progress notes (`0021`, publish switch) and system-authored self-care tips |
| C-7 | Admin neither authors nor edits clinical recommendations | Admin is an operational role, not the treating clinician |
| C-8 | Admin cannot read private patient–doctor messages | Clinical confidentiality; same reasoning as C-6 |
| C-9 | Chat messages are never deleted | Correspondence is part of the consultation record |
| C-10 | Notifications are event-generated, not hand-composed | Matches `0008` trigger design; no realistic manual-broadcast requirement |
| C-11 | Consultations are created/updated/cancelled by patient and doctor; admin is oversight (read-only) | Separation of operational oversight from clinical workflow |
| C-12 | Reports are generated on demand; no stored reports to update or delete | Nothing persisted ⇒ no update/delete semantics |
| C-13 | Stress weights are versioned algorithm constants, not admin-editable data | Changing weights silently would invalidate historical scores |
| C-14 | Consent records are never deleted | Proof of consent must outlive the account |
| C-15 | The built-in PSS-10 is version-locked in the app (translated en/fil/ceb) and is not editable through the admin form; the admin tool editor hides its questions for Multi-Modal tools | It is a licensed, published instrument — per-tenant edits would invalidate comparability; custom surveys are fully supported as DB-driven Supplementary/Brief tools (A-4) |

## Appendix D · Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Programmer(s) | | | |
| Clinical reviewer (doctor) — C-6 specifically | | | |
| Adviser — Appendices A–C | | | |

*Module status may only be reported as "covered" for a deviating cell once the
corresponding Appendix C row is initialled above.*
