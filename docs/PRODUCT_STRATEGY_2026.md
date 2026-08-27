# Kalpanaaa HRMS — Product & Business Strategy, 2026

Written 2026-08-23. Every claim below was verified against the repo at commit `142dba3`; the verification command is given where it matters, so you can re-run it after changes.

---

## 1. What you actually have today

~30,000 lines, 45 components, 21 Firestore collections, React 19 + Vite 6 + Tailwind 4 + Firebase 12, installable PWA. Five roles (CTO/CEO, HR, PM, Employee, plus public verification).

This is a **good internal HRMS for one company**. It is not yet a product. The distinction is not cosmetic, and it is the single most important fact in this document — see §2.1.

**What is genuinely strong, and rarer than you probably think:**

| Capability | Why it matters commercially |
|---|---|
| Client-side face recognition (`@vladmandic/face-api`) with a consent gate and a QR/GPS decline path | Device-free biometrics. Competitors either self-report or need a ₹15–25k wall unit. Zero per-scan cloud cost because matching happens on-device. |
| Geofenced work zones + Leaflet map (`workZones`, `WorkZoneMapPreview`) | Field/hybrid teams are the hardest attendance problem and the one SMB tools handle worst. |
| Live presence over Realtime DB (`presenceEngine.ts`, multi-tab reconciliation) | "Who is working right now" as a real-time view. Almost no SMB HRMS does live. Executives buy this on sight. |
| Immutable audit trail (`auditLogs`) + error telemetry (`error_logs`) from day one | Most SMB tools bolt this on at enterprise-deal time. You have it already. |
| Offline resilience that was clearly engineered, not accidental — `safeStorage`, `subscribeWithRecovery`, `lazyWithRetry` | Indian mobile networks. This is a felt quality difference. |
| Hierarchy-enforced performance feedback with server-side tier rules | Shipped 2026-08-23. Genuinely better than the "everyone with a manager role sees everything" default. |
| Public QR employment verification (`public/VerificationView.tsx`) | A differentiator nobody markets. See §5.5. |
| 83 passing logic tests, `tsc --noEmit` in the build gate | You can refactor without fear. Most products at this stage cannot. |

Protect this list. It is your actual asset, and §5 is built entirely on it.

---

## 2. Gaps — grouped by what they block

### 2.1 BLOCKING: you cannot sell a single seat until these are fixed

**(a) There is no tenant. At all.**

```bash
grep -rn "tenantId\|companyId\|orgId\|organizationId\|workspaceId" src/
```

Zero hits. Every collection is top-level and globally scoped: `/employees/{uid}`, `/attendance/{id}`, `/settings/{id}`. Two customers in this database would see each other's payroll.

This is not a feature gap, it is an architectural one, and **it must be done before anything else in this document** — every collection, every security rule, every composite index, and every one of the ~40 query sites gets touched. The cost is roughly linear in how many features exist when you do it. Adding statutory payroll first and multi-tenancy second could easily double the total work.

The shape to aim for: `/tenants/{tenantId}/employees/{id}`, tenant id resolved once from a custom auth claim (not from a document read — a claim is free, a read is billed on every rule evaluation). Custom claims also survive the rules 10-`get()` cap, which your current `getEmployeeDocId()` pattern is already spending budget against.

**(b) No signup, no billing, no plan enforcement.**

```bash
grep -rniE "stripe|razorpay|subscription|billing" src/ --include=*.ts --include=*.tsx
```

Every hit is a false positive (Firestore `onSnapshot` "subscriptions", a `apidKey` typo in `notifications.ts`). There is no self-serve signup, no plan, no seat counting, no payment. Accounts today are 15 seeded employees with known passwords.

**(c) Indian statutory payroll does not exist.**

```bash
grep -rniE "provident|\besic?\b|\btds\b|professionalTax|gratuity|form.?16" src/
```

Zero occurrences. `SalaryDisbursement` ([src/types/index.ts:313](src/types/index.ts#L313)) is:

```ts
baseSalary: number; allowances: number; deductions: number; netPay: number;
```

Three flat numbers. No salary structure, no CTC break-up, no PF/ESI/PT/TDS, no Form 16, no ECR challan, no payslip components, no arrears, no full-and-final.

**This is the single biggest commercial gap.** In the Indian SMB market, statutory compliance is the *buying trigger* — the founder does not shop for HR software because attendance is messy, they shop because PF filing is due and their CA is annoyed. greytHR, Keka, RazorpayX Payroll and Zoho Payroll all win on exactly this. Everything else is a vitamin; this is the painkiller.

Also, the payroll month is a calendar month (`listDatesInMonth(monthKey)`); the 26th-to-25th cycle that most Indian SMBs actually run has no code behind it.

**(d) The backend half is written but never deployed.**

```bash
node -e "console.log(Object.keys(require('./firebase.json')))"
# -> [ 'hosting', 'firestore', 'database' ]
```

No `functions` block and no `storage` block. `functions/index.js` exports four functions — FCM push, scheduled backup, morning and evening reminders — and **none of them can ever run**. There is no `storage.rules` file at all. And `firestore.rules`, including everything hardened this month, is inert until:

```bash
firebase deploy --only firestore:rules
```

Consequence: no automatic checkout for a forgotten shift, no reminders, no backups, and every security fix from this month's audit is currently theatre.

**(e) DPDP Act 2023 exposure on biometrics.**

You store face descriptors. Under the DPDP Act and its 2025 rules, that is personal data requiring explicit purpose-limited consent, a withdrawal path, retention limits, breach notification, and a named grievance officer.

The good news: [ConsentModal.tsx](src/components/shared/ConsentModal.tsx) is only 66 lines but it is architecturally *right* — opt-in, with "Decline — Use QR / GPS Check-In Instead". That decline path is worth real money in a compliance conversation. What is missing is the text: purpose, retention period, withdrawal mechanism, deletion-on-exit, DPO contact, privacy policy link.

The bad news, and it is worse than the missing text: the five documented `FaceCaptureModal` bypasses. Two of them write `Math.random() * 0.1` as a 128-dimension biometric template. You cannot sell "audit-proof attendance" — the wedge in §5 — while the enrollment store can be poisoned with random noise by a one-click UI affordance. **Fix these before any marketing claim, not after.**

### 2.2 Table stakes you will lose deals over

Verified absent (zero source hits): offboarding, expense/reimbursement, recruitment/ATS, interviews, OKRs, surveys, helpdesk/tickets, timesheets, org chart, probation/confirmation, appraisal cycles, increment letters, salary advance/loan, holiday calendar, leave encashment, SSO/SAML, MFA, public API, webhooks.

Ranked by how often each one actually kills an SMB deal:

1. **Onboarding & offboarding workflows** — checklists, document collection, asset assign/return, F&F. First thing every buyer demos.
2. **Expense & reimbursement** — bundled by every competitor at this price point.
3. **Leave depth** — accrual, carry-forward, comp-off, encashment, location-specific holiday calendars. You have leave requests and locks; you do not have a leave *policy engine*.
4. **Shift rostering** — you have one fixed general shift. Retail, F&B, clinics, agencies, support teams all need multi-shift rosters, and those are precisely the buyers your face+geo attendance is best for. This gap directly contradicts your strongest feature.
5. **Integrations** — Slack/Teams, Google Workspace, Tally/Zoho Books/QuickBooks, WhatsApp, ESSL/Matrix biometric devices. Zero today.
6. **Reporting** — you have `ReportsView` and CSV export. Missing: scheduled email reports, a custom report builder, statutory register formats.
7. **IT declaration / Form 12BB / investment proofs** — arrives with payroll, employees expect it.
8. **SSO, MFA, SCIM, API, webhooks** — not needed at 10 seats, hard blockers above ~150.

### 2.3 Quality and cost gaps that undercut a "fastest in the world" claim

Measured from `dist/` after `npm run build`:

| Chunk | Size (raw) | Verdict |
|---|---|---|
| `index-*.js` | **1,312 KB** | Entry chunk. Mostly the Firebase SDK. This is your first-paint problem. |
| `vendor-faceapi-*.js` | 1,292 KB | Correctly lazy — loads only on first face-modal open. Already fixed. |
| `vendor-pdf-*.js` | 384 KB | jsPDF + autotable. |
| `PieChart-*.js` | 324 KB | Recharts, for a pie chart. |
| `vendor-motion-*.js` | 216 KB | See below. |
| `html2canvas.esm-*.js` | 200 KB | |

Specific, cheap wins:

- **You ship two copies of the same animation engine.** `framer-motion` (19 imports) and `motion` (6 imports, as `motion/react`) are the same library before and after its v12 rename, and both are in `dependencies`. Standardise on `motion/react`, drop `framer-motion`. Verify with `grep -rhoE "from '(framer-motion|motion/react)'" src/ | sort | uniq -c`.
- **`@google/genai` is a dependency that is never imported.** Dead weight in the lockfile, and a missed opportunity — see §5.3.
- **324 KB of Recharts for one pie chart.** You already have `buildPieSlices` in `attendanceEngine.ts`. Hand-roll the SVG and delete the dependency for that view.
- **Split the Firebase SDK by product.** Auth on the critical path; Firestore, RTDB, Messaging and Storage lazily. Realistic target: sub-250 KB critical path, which would genuinely beat every competitor named in §3.
- Move PDF generation server-side (a Cloud Function you need to enable anyway) and `html2canvas` + `jspdf` leave the client bundle entirely.

**Firestore cost model is the quiet risk.** The unfiltered attendance listener already documented as B29 is survivable for one company. At 100 tenants × 200 employees it is a bill you cannot explain to a board. Every listener needs a tenant filter and a date bound *before* customer two.

**Testing:** 83 logic tests is genuinely good. Missing: any end-to-end test (no Playwright), and any emulator-based rules test — so the tier rules from this month are asserted as *text*, never as *behaviour*. `@firebase/rules-unit-testing` plus Java is the fix, and it is worth breaking the zero-dependency convention for.

**Product analytics: none.** `error_logs` tells you what broke. Nothing tells you what people use, which is what you need to price and prioritise.

---

## 3. The competitive field, honestly

Approximate 2026 positions; treat pricing as directional and re-verify before you publish a comparison page.

**Indian SMB incumbents — your real competition**

| | Position | Where they beat you | Where you beat them |
|---|---|---|---|
| **greytHR** | Payroll-compliance king, ~₹3.5k/mo entry tiers | Statutory depth, CA channel, 20 years of trust | Attendance is dated; no live presence; weak mobile |
| **Keka** | Best-loved UX, ~₹6,000+/mo | Breadth (ATS + payroll + performance), brand | Priced for 50+; overkill and expensive under 25 |
| **Zoho People** | Cheapest credible, ~₹50–100/emp/mo | Zoho ecosystem lock-in, price | Attendance is basic; UX feels like a 2015 form builder |
| **Kredily** | Freemium, free core | Free tier as an acquisition engine | Thin product; monetisation unclear |
| **factoHR / Zimyo / Qandle** | Mid-market challengers | Feature breadth | Generic attendance; no device-free biometrics |
| **RazorpayX / Zoho Payroll** | Payroll-only, compliance-first | Statutory accuracy, banking rails | No attendance layer at all — **partner, don't fight** |

**Global SMB** — BambooHR, Gusto, Rippling, Deel, HiBob, Personio, Humaans. Largely irrelevant to Indian SMB (no PF/ESI, USD pricing), *except* Deel/Rippling if your buyers hire internationally.

**Attendance and time specialists — your closest functional rivals**

Jibble (free tier, face recognition), Truein (India, face + GPS, this is the one that most resembles your wedge), Connecteam, Hubstaff, Homebase. They own attendance but have **no payroll and no performance**. You are the only one positioned to hold attendance truth *and* the HR record.

**The strategic read:** the market is barbelled. Payroll-first tools with weak attendance on one end, attendance-first tools with no HR record on the other. Nobody credibly owns *both* at the small-startup price point, and the bridge between them is exactly where your existing code already sits.

---

## 4. The uncomfortable strategic truth

You will not win on breadth. Keka has hundreds of engineer-years on you and every gap in §2.2 is table stakes you would be building *to catch up*, not to differentiate.

Breadth is also the wrong goal for the buyer you named. A 12-person startup does not want an HRIS suite; they want three things to stop hurting: *did people actually work, did payroll go out correctly, is anyone about to quit.*

So: be narrow, be provably better at the narrow thing, and let payroll be the monetisation event rather than the pitch.

---

## 5. The wedge: "the attendance-truth layer for hybrid Indian startups"

Positioning: **Attendance you could hand to an auditor. Payroll that falls out of it automatically.**

Every competitor treats attendance as a data-entry problem. You already treat it as an evidence problem — face, geofence, device, immutable ledger, audit log. Lean all the way in.

### 5.1 Compliance Pack (build first, differentiates immediately)

One button: a signed, tamper-evident PDF/ZIP for any month — per-employee attendance with face-match confidence, geofence hit, device fingerprint, correction history from `auditLogs` with who changed what and when.

Sells to: anyone facing a labour inspection, anyone billing clients hourly (agencies, staffing, consultancies), anyone in a dispute over a termination. Nobody in §3 can produce this, because none of them retain the evidence.

**Precondition: close the five FaceCaptureModal bypasses.** The claim is worthless while a one-click affordance writes random noise into the biometric store.

### 5.2 Live Floor View (build second, cheapest win)

`presenceEngine.ts` already resolves multi-tab presence to online/offline plus work state. Surface it as a real-time floor: who is in, who is on break, who is remote, who has been idle. Cheap to build, demos in ten seconds, and no SMB competitor has it.

### 5.3 AI grounded in *your* ledger, not a generic chatbot

`@google/genai` is already a dependency and completely unused. The 2026 expectation is not "an AI assistant"; it is AI that answers questions only your data can answer:

- Attrition risk from real signals — break patterns, late trends, leave clustering, feedback sentiment.
- Draft an appraisal from the actual sprint and attendance record, using the hierarchy-scoped feedback you just built.
- Natural-language reports: "show me everyone who worked more than 45 hours last week."
- Anomaly detection: a geofence hit that is statistically implausible.

This is defensible in a way a chat wrapper is not, because the moat is the data, not the model.

### 5.4 WhatsApp-first for India

Indian SMB employees will not install an app. Check-in, leave requests, approvals, payslip delivery over WhatsApp Business API. Your PWA covers the desktop and power-user case; WhatsApp covers the other 80%.

### 5.5 Zero-friction onboarding

QR self-enrollment: the founder posts one code in the team group, employees enroll themselves with a face capture. The single biggest driver of SMB HR-software churn is setup abandonment. You already have QR generation, barcode printing and face capture — this is assembly, not invention.

### 5.6 Speed as a feature you can actually claim

After the §2.3 fixes, a sub-250 KB critical path and a genuinely offline-capable PWA is a demo you win on, especially against Zoho People. But do not make the claim before the work.

---

## 6. Sequenced roadmap

**Phase 0 — Foundation. Nothing else starts until this ships.**
1. `firebase deploy --only firestore:rules` — this month's security work is currently inert.
2. Add `functions` and `storage` blocks to `firebase.json`, write `storage.rules`, deploy the four dead functions.
3. **Multi-tenancy.** `/tenants/{tenantId}/…`, tenant id from a custom auth claim, every rule and index rewritten, every listener tenant-filtered and date-bounded.
4. Close the five `FaceCaptureModal` bypasses and delete the `Math.random()` template writes.
5. Emulator-based rules tests, so tier enforcement is verified as behaviour rather than as regex.

Do not add a single feature before 3 is done. Every feature added first multiplies the migration.

**Phase 1 — Sellable.**
6. Self-serve signup, seat counting, plan gating, Razorpay subscription billing (Razorpay over Stripe for Indian rupee UPI/mandate support).
7. Statutory payroll: PF, ESI, PT, TDS, Form 16, ECR challan, configurable 26th–25th cycle, salary structure with CTC break-up. **Seriously evaluate integrating Zoho Payroll or RazorpayX for v1 instead of building** — compliance is an annual treadmill that tracks the Union Budget, and it is a bad first place to spend your only engineering capacity.
8. DPDP consent text, retention policy, deletion-on-exit, DPO contact, privacy policy.
9. Product analytics. You cannot price or prioritise blind.

**Phase 2 — Differentiated.**
10. Compliance Pack (§5.1). 11. Live Floor View (§5.2). 12. Shift rostering — closes the §2.2 gap that most directly contradicts your best feature. 13. Onboarding/offboarding workflows. 14. Bundle work from §2.3.

**Phase 3 — Expand.**
15. AI layer (§5.3). 16. WhatsApp (§5.4). 17. Expense/reimbursement. 18. Integrations: Slack, Google Workspace, Tally/Zoho Books. 19. Public API + webhooks. 20. SSO/SAML/MFA for upmarket.

---

## 7. Business model

**Pricing** — per-employee-per-month, annual prepay at −20%:

| Tier | Price | Contents |
|---|---|---|
| **Free** | ₹0, up to 10 employees, forever | Attendance (face + geo + QR), leave, directory, live floor |
| **Attendance** | ~₹59/emp/mo | + Compliance Pack, shift rosters, reports, geofences |
| **Complete** | ~₹99/emp/mo | + payroll & statutory, payslips, expense |
| **Intelligence** | ~₹149/emp/mo | + AI insights, performance/appraisal cycles, API |

The free tier is the acquisition engine, not charity. Kredily proved freemium works in Indian SMB, and your marginal cost per free user is near zero because face matching happens on-device. Ten employees is deliberately just below where a startup starts feeling payroll pain — so the product grows into the paid tier as the company does.

**Motion:** land on attendance (an urgent, concrete, cheap pain), expand to payroll (the expensive, sticky one). Never lead with payroll — you will be compared to greytHR on its home turf and lose.

**Three channels, in priority order:**

1. **Chartered Accountants.** Indian SMBs buy HR software on their CA's recommendation, full stop. Build a partner portal with a client dashboard and 20% recurring revenue share. This is the highest-leverage and most-ignored channel in the market.
2. **Startup ecosystem.** Incubators, accelerators, Startup India, state startup cells. Offer the paid tier free for 12 months to cohort companies; they onboard at 5 employees and are at 40 in two years.
3. **Content SEO.** "PF calculator", "ESI eligibility", "shift roster template", "gratuity calculator". greytHR built its entire funnel this way and the keywords are still winnable. Free tools that require no signup, feeding the free tier.

**Moat, in order of durability:** (1) the attendance evidence ledger — eighteen months of audited attendance is not migratable, which makes switching genuinely expensive; (2) on-device biometrics, so your gross margin does not degrade with usage the way cloud-inference competitors' does; (3) the CA channel, which compounds and is very hard to dislodge once established.

**Instrument these four now, before you need them:**
- Activation: first successful face check-in within 24h of signup.
- Habit: weekly check-in rate per active employee.
- Expansion: seats added per account per quarter.
- The one that matters: free → paid conversion at the 10-employee boundary.

---

## 8. Risks, stated plainly

| Risk | Reality |
|---|---|
| Payroll compliance treadmill | Changes every Union Budget. Building it yourself is an annual tax on your roadmap forever. Partner for v1. |
| Biometric liability | DPDP + the existing bypasses. Both must be closed before you market on attendance integrity. |
| Multi-tenancy debt | Grows super-linearly with every feature added first. This is the one irreversible sequencing mistake available to you. |
| Firestore cost at scale | Unfiltered listeners are fine at one tenant and ruinous at a hundred. |
| Enterprise security review | No SSO, no MFA, no tenant isolation, single region. Fine under 150 seats, fatal above. |
| "Fastest in the world" | Not true today: 1.3 MB entry chunk and two animation libraries. Earn the claim, then make it. |

---

## 9. If you only do six things

1. Deploy the rules. Everything hardened this month is currently inert.
2. Multi-tenancy, before any new feature.
3. Close the biometric bypasses — they invalidate the entire wedge.
4. Statutory payroll, bought or partnered rather than built, if capacity is tight.
5. Build the Compliance Pack. It is the one thing no competitor can answer.
6. Ship the free tier under 10 employees and open the CA channel.

The most valuable sentence in this document: **your differentiation already exists in the code.** Face plus geofence plus live presence plus an immutable audit trail is a genuinely hard combination that none of the named competitors hold together. What is missing is not the product idea — it is a tenant column, a deployed backend, and statutory payroll.
