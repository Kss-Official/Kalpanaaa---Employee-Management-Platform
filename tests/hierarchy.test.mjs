// Hierarchy-wise feedback visibility: CTO ⇄ CEO / HR / PM / Employee.
// Run via: node tests/run.mjs
//
// The policy under test:
//   tier 5  CTO ⇄ CEO  peers at the top, see everything, review each other never
//   tier 3  HR         sees everything, for compliance
//   tier 2  PM         every tier-1 employee, plus what they wrote and what is
//                      written about them -- never a peer PM, HR or the board
//   tier 1  Employee   only reviews about themselves
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = process.env.KSS_TEST_OUT;
if (!OUT) {
  console.error('Run this suite through tests/run.mjs');
  process.exit(1);
}

const hierarchy = await import(pathToFileURL(join(OUT, 'hierarchy.cjs')));

const readRepoFile = async (rel) => {
  const { readFile } = await import('node:fs/promises');
  return readFile(new URL('../' + rel, import.meta.url), 'utf8');
};
// Comments describe the bug being prevented, so a source assertion that scans
// for the bug must not match the prose explaining it.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const CTO = { id: 'u-cto', employeeId: 'KSS0001', role: 'SUPER_ADMIN', executiveRole: 'CTO' };
const CEO = { id: 'u-ceo', employeeId: 'KSS0002', role: 'SUPER_ADMIN', executiveRole: 'CEO' };
const HR = { id: 'u-hr', employeeId: 'KSS0003', role: 'HR_ADMIN' };
const HR2 = { id: 'u-hr2', employeeId: 'KSS0004', role: 'HR_ADMIN' };
const PM = { id: 'u-pm', employeeId: 'KSS0005', role: 'PROJECT_MANAGER' };
const PM2 = { id: 'u-pm2', employeeId: 'KSS0006', role: 'PROJECT_MANAGER' };
const EMP = { id: 'u-emp', employeeId: 'KSS0007', role: 'EMPLOYEE' };

// ── The ladder ──────────────────────────────────────────────────────────────

test('CTO and CEO are peers on one tier, above HR, above PM, above employee', () => {
  const { tierOf, TIER_EXECUTIVE, TIER_HR, TIER_PM, TIER_EMPLOYEE } = hierarchy;
  assert.equal(tierOf(CTO), TIER_EXECUTIVE);
  assert.equal(tierOf(CEO), TIER_EXECUTIVE);
  assert.equal(tierOf(CTO), tierOf(CEO), 'CTO and CEO must be peers, not a two-rung ladder');
  assert.ok(TIER_EXECUTIVE > TIER_HR && TIER_HR > TIER_PM && TIER_PM > TIER_EMPLOYEE);

  // Tier 4 is deliberately unused so an intermediate executive layer can be
  // inserted later without renumbering the subjectTier already denormalised onto
  // every feedback document in Firestore.
  assert.ok(TIER_HR + 1 < TIER_EXECUTIVE, 'the spare tier between HR and the board is gone');
});

test('tierOf reads the role, and an unclassifiable record gets the LEAST privilege', () => {
  const { tierOf, TIER_HR, TIER_PM, TIER_EMPLOYEE } = hierarchy;
  assert.equal(tierOf(HR), TIER_HR);
  assert.equal(tierOf(PM), TIER_PM);
  assert.equal(tierOf(EMP), TIER_EMPLOYEE);

  for (const junk of [null, undefined, {}, { role: '' }, { role: 'WHATEVER' }]) {
    assert.equal(tierOf(junk), TIER_EMPLOYEE, 'an unclassifiable record was handed more than employee reach');
  }

  // designation is a free-text input, and "CONTRACTOR".includes("CTO") is true.
  // The whole-word matcher must not promote a contractor to the board.
  assert.equal(tierOf({ designation: 'Contractor' }), TIER_EMPLOYEE);
  assert.equal(tierOf({ designation: 'Coordinator' }), TIER_EMPLOYEE);
  // But a real title still resolves.
  assert.equal(tierOf({ designation: 'Chief Technology Officer' }), hierarchy.TIER_EXECUTIVE);
});

// ── Who may write about whom ────────────────────────────────────────────────

test('canReview is strictly-below, so nobody reviews a peer or a superior', () => {
  const { canReview } = hierarchy;

  // The board reaches everyone below it...
  for (const subject of [HR, PM, EMP]) assert.equal(canReview(CTO, subject), true);
  // ...but the CTO and CEO cannot review each other. They are founders and peers,
  // and neither reports to the other.
  assert.equal(canReview(CTO, CEO), false, 'CTO must not be able to review the CEO');
  assert.equal(canReview(CEO, CTO), false, 'CEO must not be able to review the CTO');

  assert.equal(canReview(HR, PM), true);
  assert.equal(canReview(HR, EMP), true);
  assert.equal(canReview(HR, HR2), false, 'HR must not review a peer HR');
  assert.equal(canReview(HR, CEO), false);

  // REGRESSION: the compose dropdown filtered on !isExecutiveOrLeadership(e),
  // which excluded the CTO and CEO but still offered a PM every PEER PM, and HR
  // too -- HR_ADMIN is not "executive leadership".
  assert.equal(canReview(PM, EMP), true);
  assert.equal(canReview(PM, PM2), false, 'a PM must not be able to review a peer PM');
  assert.equal(canReview(PM, HR), false, 'a PM must not be able to review HR');
  assert.equal(canReview(PM, CTO), false);

  // An employee reviews nobody, least of all upward.
  for (const subject of [CTO, CEO, HR, PM, EMP]) assert.equal(canReview(EMP, subject), false);
});

test('canReview refuses self-review across BOTH ways /employees is keyed', () => {
  const { canReview } = hierarchy;
  assert.equal(canReview(CTO, CTO), false);

  // Real accounts are keyed by Firebase uid, the seeded ones by a synthetic
  // 'emp-KSS…' document id with the bare code carried separately -- so the same
  // person arrives under a different key depending on the lookup. Comparing only
  // `id` would let a PM award themselves a 5.
  assert.equal(canReview(PM, { id: 'emp-KSS0005', employeeId: 'KSS0005', role: 'EMPLOYEE' }), false);
  assert.equal(canReview({ ...CTO, uid: 'shared-uid' }, { id: 'other', uid: 'shared-uid' }), false);

  // A departed employee is not a review subject.
  assert.equal(canReview(CTO, { ...EMP, status: 'Terminated' }), false);
});

// ── Who may read what ───────────────────────────────────────────────────────

test('canViewTier keeps a PM out of HR, board and peer-PM appraisals', () => {
  const { canViewTier, TIER_EXECUTIVE, TIER_HR, TIER_PM, TIER_EMPLOYEE } = hierarchy;
  const allTiers = [TIER_EXECUTIVE, TIER_HR, TIER_PM, TIER_EMPLOYEE];

  // The board and HR hold the whole record, for compliance.
  for (const subject of allTiers) {
    assert.equal(canViewTier(TIER_EXECUTIVE, subject), true);
    assert.equal(canViewTier(TIER_HR, subject), true);
  }

  // REGRESSION: `allow read: if ... || isProjectManager()` was unconditional, so
  // every PM could read the CEO's, HR's and every peer PM's appraisal. The
  // scoping existed only in the client-side display filter.
  assert.equal(canViewTier(TIER_PM, TIER_EMPLOYEE), true);
  assert.equal(canViewTier(TIER_PM, TIER_PM), false, 'a PM can still read a peer PM review');
  assert.equal(canViewTier(TIER_PM, TIER_HR), false);
  assert.equal(canViewTier(TIER_PM, TIER_EXECUTIVE), false);

  // An employee gets nothing from the tier test. Their own reviews reach them
  // through the subject check, which is a per-document property, not a tier one.
  for (const subject of allTiers) assert.equal(canViewTier(TIER_EMPLOYEE, subject), false);

  // A tier from a future release, or one missing entirely, must fail CLOSED.
  assert.equal(canViewTier(TIER_PM, 99), false);
  assert.equal(canViewTier(TIER_PM, Number.MAX_SAFE_INTEGER), false);
  assert.equal(canViewTier(TIER_EMPLOYEE, 99), false);
});

test('isSamePerson matches across uid, synthetic doc id and employee code', () => {
  const { isSamePerson } = hierarchy;
  assert.equal(isSamePerson({ id: 'abc' }, { uid: 'abc' }), true);
  assert.equal(isSamePerson({ employeeId: 'KSS0005' }, { employeeId: 'KSS0005' }), true);
  assert.equal(isSamePerson({ id: 'abc' }, { id: 'xyz' }), false);
  // Two records that are simply both incomplete are not the same person.
  assert.equal(isSamePerson({}, {}), false);
  assert.equal(isSamePerson(null, { id: 'abc' }), false);
  assert.equal(isSamePerson({ id: undefined }, { id: undefined }), false);
});

test('isAuthorizedTechLead authorizes Satya Ranjan Das and Jason Kenneth N for cross-organization review', () => {
  const { isAuthorizedTechLead, canReview, canViewTier } = hierarchy;
  
  const satya = {
    id: 'emp-KSS2407012',
    employeeId: 'KSS2407012',
    fullName: 'Satya Ranjan Das',
    email: 'satya.ranjan.dash@kalpanaaa.in',
    role: 'EMPLOYEE'
  };

  const jason = {
    id: 'KfAB95lpbJOeylpKQaWX4GXOPGt2',
    employeeId: 'KSS2407014',
    fullName: 'Jason Kenneth N',
    email: 'jasonkennethn@kalpanaaa.in',
    role: 'EMPLOYEE'
  };

  assert.equal(isAuthorizedTechLead(satya), true);
  assert.equal(isAuthorizedTechLead(jason), true);
  assert.equal(isAuthorizedTechLead(EMP), false);

  // Authorized tech leads can review any other employee across the organization
  for (const subject of [EMP, PM, HR, CTO, CEO]) {
    assert.equal(canReview(satya, subject), true, `Satya must be able to review ${subject.role || subject.designation}`);
    assert.equal(canReview(jason, subject), true, `Jason must be able to review ${subject.role || subject.designation}`);
  }

  // But neither can review themselves
  assert.equal(canReview(satya, satya), false, 'Satya must not be able to self-review');
  assert.equal(canReview(jason, jason), false, 'Jason must not be able to self-review');

  // Can view tier policy
  assert.equal(canViewTier(hierarchy.TIER_EMPLOYEE, hierarchy.TIER_EXECUTIVE, satya), true);
});

// ── The enforceable boundary ─────────────────────────────────────────────────

test('each listener satisfies exactly one disjunct of the read rule', async () => {
  const code = stripComments(await readRepoFile('src/lib/feedbackService.ts'));

  // REGRESSION: both views listened to the whole collection. Firestore rejects a
  // query outright when the rules cannot be satisfied for every document it could
  // return, so the employee listener was permission-denied in production and the
  // view silently fell back to whatever localStorage happened to hold.
  //
  // A single query cannot OR across different fields, and a PM's entitlement
  // spans three of them, so there is one query per disjunct.
  assert.match(code, /where\('subjectTier', '==', TIER_EMPLOYEE\)/);
  assert.match(code, /where\('reviewerId', '==', selfId\)/);
  assert.match(code, /where\('targetEmployeeCode', '==', code\)/);

  // A missing subjectTier must not read as the most permissive value.
  assert.match(code, /MAX_SAFE_INTEGER/);

  // Neither view may reconstruct a collection-wide listen of its own.
  for (const f of ['src/components/feedback/FeedbackHub.tsx',
                   'src/components/employee/EmployeeFeedbackView.tsx']) {
    const view = await readRepoFile(f);
    assert.match(view, /subscribeToFeedbacks/, f + ' does not use the scoped subscription');
    assert.equal(/collection\(db, 'performanceFeedbacks'\)/.test(view), false,
      f + ' listens collection-wide again');
  }
});

test('compose stamps subjectTier from the directory and tier-gates its targets', async () => {
  const hub = await readRepoFile('src/components/feedback/FeedbackHub.tsx');

  // subjectTier is what the read rule authorises against. If create stops
  // stamping it, every new review is both rejected on write and invisible to PMs.
  assert.match(hub, /subjectTier: tierOf\(targetEmp\)/);
  assert.match(hub, /employees\.filter\(e => canReview\(activeEmployee, e\)\)/);
  assert.equal(/return !isExecutiveOrLeadership\(e\);/.test(hub), false,
    'the old PM target filter is back -- it let a PM review a peer PM');
});

test('rules enforce the hierarchy server-side, not just in the UI', async () => {
  const rules = await readRepoFile('firestore.rules');
  const block = rules.slice(rules.indexOf('match /performanceFeedbacks'));
  const code = stripComments(block.slice(0, block.indexOf('\n    }') + 6));

  // REGRESSION: the read rule was `isConfigAdmin() || isProjectManager() ||
  // isSubject()`. The bare isProjectManager() handed every PM the entire
  // appraisal collection -- HR's, the CEO's and every peer PM's.
  assert.equal(/allow read:[^;]*\|\|\s*isProjectManager\(\)\s*\|\|/.test(code), false,
    'PM read is unconditional again');
  assert.match(code, /isProjectManager\(\) && resource\.data\.subjectTier == 1/);

  // A PM must still reach a review they wrote about someone since promoted.
  const readRule = code.slice(code.indexOf('allow read:'));
  assert.match(readRule.slice(0, readRule.indexOf(';')), /isAuthor\(\)/);

  // Create is bounded by the author's own tier -- the same strictly-below test
  // canReview() applies in the client.
  assert.match(code, /function callerTier\(\)/);
  assert.match(code, /subjectTier is number/);
  assert.match(code, /subjectTier < callerTier\(\)/);

  // And the tier cannot be moved afterwards to widen who can see the review.
  const updateRule = code.slice(code.indexOf('allow update:'));
  assert.match(updateRule.slice(0, updateRule.indexOf(';')), /unchanged\('subjectTier'\)/);
});

test('the leadership note is not a field on a document the subject can read', async () => {
  const types = await readRepoFile('src/types/index.ts');
  const service = await readRepoFile('src/lib/feedbackService.ts');
  const hub = await readRepoFile('src/components/feedback/FeedbackHub.tsx');
  const rules = await readRepoFile('firestore.rules');

  // REGRESSION: `privateLeadershipNotes` was a field on the feedback document,
  // hidden behind `{isExecutive && ...}` in the markup. Firestore has no
  // field-level read security and the subject MUST be able to read that document
  // to acknowledge it, so an employee could read the confidential note written
  // about them straight out of devtools. The guard was real in the UI and
  // meaningless in the data.
  const declaration = /privateLeadershipNotes\??\s*:/;
  assert.equal(declaration.test(stripComments(types)), false,
    'privateLeadershipNotes is a document field again');
  assert.equal(declaration.test(stripComments(hub)), false,
    'FeedbackHub writes privateLeadershipNotes into the review document again');
  assert.equal(/fb\.privateLeadershipNotes/.test(stripComments(hub)), false,
    'the note is being read off the parent document again');

  // It now lives in a subcollection, which is the granularity Firestore
  // authorises at, restricted to HR and the board.
  assert.match(stripComments(service), /'performanceFeedbacks', feedbackId, 'confidential', 'notes'/);
  assert.match(stripComments(rules), /match \/confidential\/\{noteId\}\s*\{\s*allow read, write: if isConfigAdmin\(\);/);

  // The flag on the parent tells the UI a note exists without spending a read
  // per card; the text is fetched only on an explicit reveal.
  assert.match(hub, /fb\.hasConfidentialNote && isExecutive/);
  assert.match(hub, /fetchConfidentialNote/);

  // And the flag records what actually landed rather than what was hoped for.
  assert.match(stripComments(hub), /hasConfidentialNote = noteSaved/);
});

test('the client tier ladder and the rules tier ladder agree', async () => {
  const rules = await readRepoFile('firestore.rules');
  const callerTier = rules.slice(rules.indexOf('function callerTier()'));
  const body = callerTier.slice(0, callerTier.indexOf('}'));

  // Two independent copies of the same ladder, one in TypeScript and one in a
  // rules expression. If they drift, the UI shows rows the server refuses -- or
  // worse, hides rows it would have served.
  assert.match(body, new RegExp('isSuperAdmin\\(\\) \\? ' + hierarchy.TIER_EXECUTIVE));
  assert.match(body, new RegExp('isHrAdmin\\(\\) \\? ' + hierarchy.TIER_HR));
  assert.match(body, new RegExp('isProjectManager\\(\\) \\? ' + hierarchy.TIER_PM));
  assert.match(body, new RegExp(': ' + hierarchy.TIER_EMPLOYEE));

  // The PM read clause is a literal, so it has to track TIER_EMPLOYEE too.
  assert.match(rules, new RegExp('resource\\.data\\.subjectTier == ' + hierarchy.TIER_EMPLOYEE));
});
