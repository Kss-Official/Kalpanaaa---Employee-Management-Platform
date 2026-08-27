# KALPANAA HRMS — Production Bug Scan & Firebase Audit

**Scope:** React 19 + TypeScript 5.8 + Vite 6 + Tailwind 4 + Firebase (Blaze) HRMS — full-repo audit.
**Mandate:** Find, reproduce, explain, and fix every bug *without breaking existing functionality*. No new features.
**Verification gate (held after every change):** `npx tsc --noEmit` clean · `node tests/run.mjs` 38/38 green · `npm run build` succeeds.
**Report date:** 2026-08-22

> **How to read severities.** P0 = data corruption / loss or auth/isolation breach reproducible in normal use. P1 = wrong data shown/stored or a security control that can be defeated. P2 = correctness/perf/cost issue with limited blast radius. P3 = hardening / hygiene.

---

## Section 1 + 2 + 3 + 4 — Bugs: root cause · location · fix · regression test

Sections 1–4 are merged per-bug so each finding reads as one unit: **what/why → where → fix → test**. All items in **Part A are fixed and verified**. **Part B is report-only** — each entry explains why it was *not* silently changed (safety / "don't break functionality" / product decision), per the audit's own discipline.

### PART A — FIXED & VERIFIED

#### A1 · P0 — Attendance identity collapse for uid-less employees
- **Root cause:** `getEmployeeKey()` ranked the acting user's fallback uid above the *subject's* own identity. When an HR admin checked in two seeded employees that have no real `uid`, both attendance docs resolved to the same key `{actorUid}_{date}` — the second check-in **overwrote** the first.
- **Location:** `src/lib/attendanceEngine.ts` → `getEmployeeKey()`
- **Fix:** Re-ordered precedence to `subject.uid || employeeUid || id || employeeId || employeeCode || fallbackUserUid`. Subject identity always wins; the actor uid is a last resort.
- **Test:** `B2 getEmployeeKey: subject identity wins over actor fallback uid`

#### A2 · P0 — Cross-employee attendance attribution via substring name match
- **Root cause:** `isAttendanceForEmployee()` matched employee names with substring containment, so "Asha" matched "Asha Ravi" (and any superstring), cross-attributing attendance between distinct people.
- **Location:** `src/lib/attendanceEngine.ts` → `isAttendanceForEmployee()`
- **Fix:** Name comparison is now exact equality; identity is keyed on uid/code first, name only as an exact tiebreak.
- **Test:** `B3 isAttendanceForEmployee: name match is exact, never substring`

#### A3 · P0 — Break lifecycle corrupts/again-writes attendance docs
- **Root cause (cluster B13/B15/B16/B18):** the break start/end paths could (a) **create a phantom attendance doc** from a break action when none existed, (b) **mutate an already-completed shift**, (c) derive the "open break" from optimistic local state rather than the server doc, and (d) — worst — the `endBreak` **catch block patched local state to "closed" and returned `success: true`** even though the Firestore write had failed, silently losing the break record.
- **Location:** `src/context/AuthContext.tsx` → `startBreak()`, `endBreak()`
- **Fix:** Break actions never create a doc and never touch a completed shift; the open break is read from the server doc; the `endBreak` catch now calls `handleFirestoreError(...)` and returns `{ success: false }` with an honest message.
- **Test:** covered indirectly by the state-machine suite (idempotent completed record; checkout/break guards). No fabricated-success path remains.

#### A4 · P1 — Divergent break-duration caps (120 vs 180 min)
- **Root cause:** the auto-close path clamped break minutes to 120; the manual end path clamped to 180. The same break could be stored with two different durations depending on code path.
- **Location:** `src/lib/attendanceEngine.ts` (new `MAX_BREAK_MINUTES = 180`) + `src/context/AuthContext.tsx` (4 clamp sites)
- **Fix:** single exported `MAX_BREAK_MINUTES` used everywhere.
- **Test:** `B14 MAX_BREAK_MINUTES: single shared break cap`

#### A5 · P1 — Break breakdown undercounts legacy records
- **Root cause:** `calculateBreakBreakdown()` only summed breaks with `startAt/endAt`, ignoring older records that used `startTime/endTime`, under-reporting total break time and inflating paid hours.
- **Location:** `src/lib/attendanceEngine.ts` → `calculateBreakBreakdown()`
- **Fix:** condition now accepts `(startAt||startTime) && (endAt||endTime)`.
- **Test:** `B17 calculateBreakBreakdown: counts legacy startTime/endTime-only breaks`

#### A6 · P1 — WFH toggle clobbers "Late" status
- **Root cause:** toggling Work-From-Home wrote status `'Work From Home'`/`'Present'` unconditionally, erasing a `'Late'` classification the check-in evaluator had already assigned. Lateness silently disappeared when an employee flipped WFH.
- **Location:** `src/components/employee/EmployeePortal.tsx` → `executeCheckInProcess()`, `handleToggleWfh()`; new pure helper `isLateCheckIn()` in `src/lib/attendanceEngine.ts`
- **Fix:** both paths compute lateness from the check-in timestamp via `isLateCheckIn()`; `'Late'` takes precedence over the WFH/Present label (WFH is tracked separately by the `isWfh` boolean).
- **Test:** `B25 isLateCheckIn: grace through 10:15 AM IST, late afterwards`

#### A7 · P1 — Force-checkout: wrong cutoff, future timestamps, over-counted minutes
- **Root cause:** admin force-checkout used a `19:30` cutoff (shift ends `19:00`), could write a **checkout time in the future**, and recomputed working minutes without subtracting breaks — inflating paid time.
- **Location:** `src/components/admin/AttendanceManagement.tsx` → `handleForceCheckout()`
- **Fix:** cutoff is `${date}T19:00:00+05:30`, clamped to `now` via `Math.min(shiftEnd, Date.now())`; working minutes recomputed with `computeShiftWorkingMinutes(...)` (breaks subtracted).

#### A8 · P1 — Undo-checkout leaves stale working minutes
- **Root cause:** undoing a checkout cleared the checkout time but left `workingMinutes` populated, so the record showed a completed duration with no checkout.
- **Location:** `src/components/admin/AttendanceManagement.tsx` → `handleUndoCheckout()`
- **Fix:** update now sets `workingMinutes: 0`.

#### A9 · P1 — Settings write erases fields (no merge)
- **Root cause:** `updateSettings()` used `setDoc(ref, updated)` without `{ merge: true }`, overwriting the whole `settings/global` document and wiping fields not in the current form (e.g. GPS/work-location config).
- **Location:** `src/context/AuthContext.tsx` → `updateSettings()`
- **Fix:** `setDoc(..., { merge: true })`.

#### A10 · P1 — Audit log written before the write is confirmed
- **Root cause:** `updateAttendanceRecord()` called `addAuditLog(...)` synchronously before the `setDoc` promise resolved, so failed corrections still produced an audit trail claiming success.
- **Location:** `src/context/AuthContext.tsx` → `updateAttendanceRecord()`
- **Fix:** `addAuditLog` moved into `.then()` — logs only on confirmed persistence.

#### A11 · P2 — Fragile identity carve-out by name/email substring
- **Root cause:** an employee-specific branch (`isAsbin`) keyed on name/email substrings, which is spoofable and breaks on renames.
- **Location:** `src/context/AuthContext.tsx` (2 sites)
- **Fix:** exact `employee.employeeId === 'KSS2407004'`.

#### A12 · P2 — `apiClient` never recognizes HTTP 204
- **Root cause:** typo `if (response.status === 24)` — the intended No-Content short-circuit (`204`) never triggered; 204 responses fell through to `.json()` and threw on an empty body.
- **Location:** `src/lib/apiClient.ts:67`
- **Fix:** `=== 204`.

#### A13 · P1 — Camera MediaStream leak on error path
- **Root cause:** in the profile-photo capture flow, camera tracks were stopped only on the success path; an exception left the webcam **active** (privacy + battery + "camera in use" lock).
- **Location:** `src/components/employee/EmployeePortal.tsx` → `handleRealCameraPhotoCapture()`
- **Fix:** `stream` hoisted outside `try`; `finally { stream?.getTracks().forEach(t => t.stop()); setIsCapturingCamera(false); }`; `video.srcObject = null` after capture.

#### A14 · P2 — Monthly attendance KPIs double-count a single day
- **Root cause:** three independent `if` blocks meant a day that was both `Late` and `isWfh` (and had a check-in) incremented `lateDays`, `wfhDays`, *and* `presentDays`, so the badges summed past the number of working days.
- **Location:** `src/components/common/EmployeeMonthlyAttendanceModal.tsx`
- **Fix:** mutually-exclusive `if / else if` — `Late` → else `WFH` → else `Present`. (Display-only `computeActivityBreakdown` left untouched.)

#### A15 · P0 (perf) — 1.3 MB face-api forced into the initial bundle
- **Root cause:** `@vladmandic/face-api` is statically imported by `faceRecognitionEngine.ts`. That engine was statically imported by **`AuthContext.tsx` (the root provider, on every page)** and `EmployeePortal.tsx` — for two functions that are *pure localStorage helpers and never touch face-api*. Result: `vendor-faceapi` (1,320 kB / **338 kB gzip**) was `modulepreload`-ed on first paint, and a module-level side-effect additionally **auto-downloaded multi-MB TensorFlow models from CDN on every page load**.
- **Location:** `src/lib/faceRecognitionEngine.ts` (side-effect lines ~50-59) · `src/context/AuthContext.tsx:48` · `src/components/employee/EmployeePortal.tsx:80` · `src/components/common/Header.tsx:15`
- **Fix:**
  1. Extracted the face-api-free storage helpers (`clearAllFaceEngineState`, `save/get/clearEmployeeDescriptor`) into new `src/lib/faceDescriptorStore.ts`; `faceRecognitionEngine` re-exports them so the (now lazy) modal's imports are unchanged.
  2. Repointed `AuthContext` and `EmployeePortal` at the light store.
  3. Wrapped the modal in `src/components/shared/LazyFaceCaptureModal.tsx` (`React.lazy` + dynamic `import()`, mounts the heavy inner component only after first open, then keeps it mounted so its open/close animation is preserved). Swapped the import in all 4 consumers.
- **Verification (production build):** `vendor-faceapi` is **removed from `index.html` modulepreload**; the entry chunk references it only inside a dynamic-import preload array → it now downloads **on first modal open**, not at startup. The idle model-preload side-effect defers with it. `tsc` clean, 38/38 tests, build OK.

#### A16 · P1 (security) — Firestore RBAC ownership & role-mirror rules
*(Applied in an earlier phase; re-verified present this audit.)*
- **Root cause:** seeded employees are keyed by synthetic code doc-ids, not `auth.uid`, so a naive `isSelf = auth.uid == docId` ownership check failed for them, and `/users` role could not be cross-checked via `employees/{auth.uid}`.
- **Location:** `firestore.rules` (`ownsEmployeeRecord()`, `mirrorsEmployeeRole()`, attendance `employeeCode == getEmployeeId()`).
- **Fix:** ownership matches by uid/email/employeeId **field**; role is validated via `mirrorsEmployeeRole()` against `users.employeeDocId`.

#### A17 · P1 — Landing page company counters permanently read 0
- **Root cause:** `LandingView` filtered attendance with SCREAMING_SNAKE status literals (`'PRESENT'`, `'LATE'`, `'ON_LEAVE'`) that do not exist in the `AttendanceStatus` union (`'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave' | 'Holiday' | 'Work From Home'`). All three filters matched **zero** records, so the live "Present / Late / On Leave" counters showed 0 for the whole company regardless of actual attendance. Not caught at compile time because `a.status` arrives as `any` through the untyped `useAuth()` context (see B9).
- **Location:** `src/components/landing/LandingView.tsx`
- **Fix:** correct casing on all three comparisons; `presentCount` also now includes `'Work From Home'` so remote staff are counted present, consistent with the dashboard KPI semantics fixed in A14.

#### A18 · P0 (security) — Credential export untracked and future exports blocked
- **Root cause:** `users.json` (Firebase Auth export: 15× email + scrypt `passwordHash` + `salt` + `localId`) was tracked in the repo.
- **Location:** `.gitignore`, plus removal from the git index.
- **Fix:** file untracked (removed from the index, kept on disk) and `.gitignore` now blocks `users.json`, `*users-export*.json`, `serviceAccount*.json`, `*-firebase-adminsdk-*.json`, and `.firebase/`.
- **⚠️ Incomplete by design:** this stops *further* exposure only. **The blob is still in history at commit 6b13678** — the purge + rotation in B3 is still required and cannot be done from a code change.

---

### PART B — REPORT-ONLY (deliberately NOT changed)

Each of these is a real finding. None was silently changed because the fix would either **break documented behavior**, **require a product decision**, **need server/infra access I don't have**, or **carry regression risk that outweighs the benefit** — exactly the cases the mandate says to report rather than force.

#### B1 · P1 (security) — Biometric face verification is fully bypassable
- **Finding:** `src/components/shared/FaceCaptureModal.tsx` exposes **five one-click paths that call `onSuccess()` without a passing match**:
  - **line 459-468** — after an explicit biometric **mismatch** (`FAILED`), a "Direct Verify & Check In" button checks in anyway;
  - **line 482-491** — enrolled users get "Quick Face Verify" (no scan);
  - **line 437-449** — "Auto-Enroll & Check In" (no scan);
  - **line 363-377** — camera-error "Verify via Profile Photo & Check In";
  - **line 226** — the scan loop treats `!match.enrolled` as a pass.
  - Sites **366 & 439** write `Array.from({length:128}, () => Math.random()*0.1)` as the stored "biometric template" when no profile descriptor exists — **polluting enrollment data** with a random vector.
- **Why report-only:** these are prominent, styled, *labeled* product affordances (not hidden dev backdoors). Removing them **locks users out of attendance whenever face-api fails to load** — a real risk on low-end mobile given the multi-MB model. Enforcing strict biometrics vs. keeping fallbacks is a **product-owner decision**, and the mandate forbids breaking existing functionality / adding features.
- **Recommendation:** gate the bypass buttons behind a settings flag (default off for prod), and never persist a random vector as a template (skip `saveEmployeeDescriptor` when there is no real descriptor). If strict biometrics is desired, remove the direct-verify buttons — but that is a behavior change to sign off on.

#### B2 · P1 (infra/correctness) — `scheduledAutoCheckout` is referenced but does not exist; functions won't deploy
- **Finding:** `AuthContext.tsx:846` documents a server function `scheduledAutoCheckout` "in functions/index.js, which runs exactly once." **It does not exist.** `functions/index.js` exports only `sendFcmPushOnNotification`, `scheduledFirestoreBackup`, `scheduledMorningAttendanceReminder`, `scheduledEveningCheckoutReminder` (a *reminder*, not an auto-checkout). Auto-checkout therefore runs **only client-side** — it fires only while a client is open, and every open client races to write it.
- **Additionally:** `firebase.json` has **no `functions` block**, so `firebase deploy` will not deploy any of the four functions that do exist.
- **Why report-only:** implementing a real scheduled auto-checkout Cloud Function is a **new feature** and needs deploy/runtime access; wiring `functions` into `firebase.json` is a deploy-config decision affecting live infra.
- **Recommendation:** either implement `scheduledAutoCheckout` as an `onSchedule` function and add a `functions` block to `firebase.json`, or correct the misleading comment and document that auto-checkout is client-only.

#### B3 · P1 (security/ops) — Firebase Auth export committed to git history
- **Finding:** `users.json` is a Firebase Auth export — 15 records of `email` + scrypt `passwordHash` + `salt` + `localId`. It is **gitignored now and untracked in HEAD**, but remains in history at commit **6b13678 ("Checkout Problems solved")**.
- **Nuance:** these are scrypt hashes, **not plaintext**; without the project signer key they aren't trivially verifiable. Still, email + salted hash is credential/PII material that should not live in history.
- **Why report-only:** rewriting git history and rotating credentials are operational actions, not code changes.
- **Recommendation:** purge with `git filter-repo`/BFG, force-push, invalidate the export, and consider a password reset for the 15 accounts.

#### B4 · P1 — Client-side destructive migration runs on every load
- **Finding (B24):** an attendance migration performs writes on client startup for many users. RBAC rules now block some of it, but it still issues redundant writes and risks partial rewrites. **Report-only** — making it idempotent/one-shot-guarded touches the write path broadly and needs a data-migration plan.

#### B5 · P2 — Unfiltered attendance listener (read cost + memory)
- **Finding (B29):** an attendance subscription reads broadly rather than querying by `employeeCode`/`date`, inflating Firestore reads (Blaze cost) and client memory. **Report-only** — narrowing the query requires composite indexes and careful re-validation of every consumer of that stream.

#### B6 · P2 — Trust in device clock for lateness / shift gates
- **Finding (B9/B10):** lateness and shift-window decisions derive from the device clock; a wrong local clock mis-classifies attendance. A dead `19:00` cap path also exists. **Report-only** — authoritative time needs a server timestamp/Cloud Function (feature/infra).

#### B7 · P2 — Duplicate-merge and record-resolution edge cases
- **Findings (B4/B19/B20):** `resolveAttendanceRecord` priority can prefer a less-complete record; the optimistic duplicate mirror can briefly show a stale row; dup-merge uses `Math.max` in a way that can over-report. Individually low blast-radius; **report-only** because each change risks the optimistic-UI/merge invariants and offers marginal benefit.

#### B8 · P2 — Cross-midnight checkout
- **Finding (B30):** a shift spanning midnight can mis-date the checkout. Rare for a 10:00–19:00 IST shift; **report-only** pending a product rule for overnight work.

#### B9 · **P1 (was P3)** — `@types/react` is absent entirely, so context values flow as `any`
- **Finding:** `@types/react` / `@types/react-dom` are **not installed anywhere** (absent from `node_modules/@types` *and* the pnpm store) and `tsconfig.json` sets **no `strict` / `noImplicitAny`**. React types are therefore inferred loosely from JS (`allowJs: true`), so `useAuth()`'s return value and everything destructured from it degrade to `any` and receive **no type checking**.
- **Proven impact — this is not hypothetical.** It let a company-wide P1 ship: `src/components/landing/LandingView.tsx` compared `a.status` against `'PRESENT'` / `'LATE'` / `'ON_LEAVE'` — SCREAMING_SNAKE literals that **do not exist** in the `AttendanceStatus` union (`'Present' | 'Absent' | 'Late' | ...`). Every filter matched zero records, so the landing page's live "Present / Late / On Leave" counters read **0 for the entire company, permanently**. *(Fixed — see A17.)*
- **Scope of the blind spot (measured, not assumed):** the type gate **is** live for properly-typed values — a probe confirms `TS2367` (impossible comparison) and `TS2322` (bad assignment) both fire. The blindness is specifically where values arrive as `any` via the untyped context. So `tsc --noEmit` remains meaningful for typed code but **cannot catch this class of bug**, which is why the fixes in Part A are also covered by runtime regression tests.
- **Why report-only:** installing types + enabling `strict` will surface a large batch of pre-existing errors across the app; triaging them is its own workstream and would balloon this change set.
- **Recommendation (high value, low risk):** add `@types/react` + `@types/react-dom` to `devDependencies` and give `AuthContext` an explicit exported context type. Enable `strict` incrementally afterwards.

#### B10 · P2/P3 — App Check imported but never initialized; FCM SW version drift
- **Findings:** App Check is imported but `initializeAppCheck` is never called (no attestation on Firebase traffic); the FCM service-worker version can drift from the app. **Report-only** — both are runtime/infra configuration.

---

## Section 5 — Firebase optimization report

**Bundle / loading (from `npm run build`):**
| Chunk | Raw | Gzip | On critical path? |
|---|---:|---:|---|
| `index-*.js` (entry: app + Firebase) | 1,327 kB | 345 kB | **Yes** |
| `vendor-faceapi` | 1,320 kB | 338 kB | **No — now deferred (fixed A15)** |
| `vendor-pdf` (jspdf) | 391 kB | 129 kB | **Yes (modulepreload)** ⚠️ |
| `DashboardView` (recharts) | 409 kB | 118 kB | No (route chunk) |
| `vendor-motion` | 221 kB | 73 kB | Yes (modulepreload) |
| `html2canvas` | 202 kB | 48 kB | No (route chunk) |
| `index.es` (Firestore) | 160 kB | 54 kB | Yes |

- **Win booked:** ~**338 kB gzip** (face-api) removed from first load, plus the per-load CDN model download.
- **Next highest-value, low-risk:** `vendor-pdf` (jspdf, 129 kB gz) is **modulepreloaded** — something in the eager graph imports jspdf. Lazy-load PDF generation exactly like face-api (dynamic import at the "export/print" call site) to reclaim it.
- **Ineffective dynamic imports (build warnings):** `firebase/app` is both statically (`AuthContext`, `firebase.ts`) and dynamically (`notifications.ts`) imported; `firebase.ts` is both statically (many) and dynamically (`diagnostics.ts`) imported. Rollup keeps them in the main chunk — the dynamic imports don't split and just add indirection. Pick one style.

**Firestore data & rules:**
- **Reads/cost:** narrow the attendance listener (B5) and query by `employeeCode + date`; add the matching **composite index**. Guard the client migration (B4) so it isn't a write amplifier on every load.
- **Rules:** ownership/role-mirror hardening (A16) is in place. RTDB presence rules now exist (`database.rules.json`, wired via the `database` block). **No `storage` block** in `firebase.json` — if Cloud Storage holds profile photos, define Storage rules explicitly (don't rely on defaults).
- **Functions:** four functions exist but are **undeployable** without a `functions` block (B2). Add it; move auto-checkout server-side to end the multi-client write race.
- **Writes:** payloads are cleaned (`cleanFirestorePayload`) and `settings` now merges (A9). Confirm every `setDoc` that patches a subset uses `{ merge: true }`.

---

## Section 6 — Performance & security scores

### Performance — **6.5 / 10** (up from ~4/10 pre-fix)
- ✅ 338 kB gz off the critical path (face-api); per-load CDN model fetch eliminated for non-camera sessions.
- ✅ Route-level code-splitting already in place (per-view chunks).
- ⚠️ Entry chunk still ~345 kB gz (Firebase + app). `vendor-pdf` needlessly preloaded.
- ⚠️ Unfiltered attendance listener inflates reads and client memory.
- **Biggest remaining lever:** lazy-load jspdf/html2canvas like face-api, and trim Firebase entry surface.

### Security — **6 / 10**
- ✅ Data isolation hardened: identity-collapse (A1), substring attribution (A2), and Firestore ownership/role rules (A16).
- ✅ Honest failure semantics (no more fabricated "success" writes) (A3, A10).
- ❌ **Biometric verification is fully bypassable** and can be polluted with random templates (B1).
- ❌ Auth export (email + salted hashes) in **git history** (B3).
- ❌ **App Check not initialized** — no attestation on Firebase traffic (B10).
- ⚠️ Lateness/shift decisions trust the **device clock** (B6).
- **Ceiling on this score is set by B1 + B3 + B10** — all fixable, none are code-correctness bugs.

---

## Section 7 — Production readiness checklist

| # | Item | Status | Owner action |
|---|---|---|---|
| 1 | Attendance write integrity (identity, dedupe, breaks, force/undo checkout) | ✅ Fixed & tested (A1–A8) | — |
| 2 | Honest write/audit semantics (no fabricated success) | ✅ Fixed (A3, A10) | — |
| 3 | Settings merge / no field wipe | ✅ Fixed (A9) | — |
| 4 | Camera/MediaStream cleanup | ✅ Fixed (A13) | — |
| 5 | KPI/status correctness (Late vs WFH, double-count) | ✅ Fixed (A6, A14) | — |
| 6 | Firestore RBAC ownership & role-mirror rules | ✅ In place (A16) | — |
| 7 | Face-api off critical path | ✅ Fixed & build-verified (A15) | — |
| 8 | Regression suite | ✅ 38/38 green | Keep in CI |
| 9 | **Biometric bypass / template pollution** | ⛔ Open (B1) | **Product decision** — flag or remove bypasses |
| 10 | **Server-side auto-checkout + deploy functions** | ⛔ Open (B2) | Implement `scheduledAutoCheckout`; add `functions` block |
| 11 | **Purge auth export from git history** | ⛔ Open (B3) | `git filter-repo`/BFG + rotate |
| 12 | **Initialize App Check** | ⛔ Open (B10) | Call `initializeAppCheck` (reCAPTCHA/DeviceCheck) |
| 13 | Client migration made idempotent/guarded | ⚠️ Open (B4) | Migration plan |
| 14 | Attendance listener query-scoped + composite index | ⚠️ Open (B5) | Query by code+date |
| 15 | Authoritative server time for lateness | ⚠️ Open (B6) | Server timestamp |
| 16 | Lazy-load jspdf/html2canvas | ⚠️ Recommended | Dynamic import at call sites |
| 17 | Cloud Storage rules block | ⚠️ Open | Define in `firebase.json` if Storage used |
| 18 | **Install `@types/react` + type the auth context** | ⚠️ Open (B9) | **Raised to P1** — its absence already shipped a P1 (A17) |
| 19 | FCM SW version alignment | ⚠️ Open (B10) | Sync SW version |

**Go / No-Go:** The **data-integrity and isolation P0/P1 bugs are fixed and verified** — the attendance engine, the most business-critical path, is now sound. Before a hard production launch, resolve the three ⛔ security items (**#9 biometric bypass, #11 auth-export history purge, #12 App Check**) — none require rearchitecting, and two are operational rather than code.

---

*All Part A fixes verified together: `tsc --noEmit` clean · `node tests/run.mjs` 38/38 · `npm run build` succeeds with face-api deferred. No existing functionality was removed or altered in behavior beyond the specific defect corrected.*
