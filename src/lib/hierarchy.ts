import { isExecutiveOrLeadership } from './attendanceEngine';

/**
 * Organisational tiers, used to decide who may review whom and who may read a
 * review once it exists.
 *
 * CTO and CEO are deliberately PEERS on one tier rather than a ladder of two.
 * Both are seeded as `SUPER_ADMIN` with an `executiveRole`, both are founders of
 * the company, and neither reports to the other -- so each sees everything,
 * including reviews about the other, and neither can file a review about the
 * other (see `canReview`: a subject must be strictly BELOW the reviewer, which
 * blocks peer review at the top and self-dealing along with it).
 *
 * The numbers are non-contiguous on purpose. Tier 4 is left free so an
 * intermediate executive layer can be inserted later without renumbering data
 * already written to Firestore -- `subjectTier` is denormalised onto every
 * feedback document and cannot be migrated cheaply.
 */
export const TIER_EXECUTIVE = 5; // CTO ⇄ CEO
export const TIER_HR = 3;
export const TIER_PM = 2;
export const TIER_EMPLOYEE = 1;

/**
 * The tier an employee sits on.
 *
 * Resolution order matches `firestore.rules`, where `isSuperAdmin()` is tested
 * before `isHrAdmin()` and `isProjectManager()` (both of which OR in super-admin
 * themselves). Keeping the same precedence here is what makes the client's view
 * agree with what the server will actually permit.
 *
 * Unknown or malformed records resolve to TIER_EMPLOYEE, the LEAST privileged
 * tier: a record we cannot classify must never be handed executive reach.
 */
export function tierOf(emp: any): number {
  if (!emp) return TIER_EMPLOYEE;

  // Executive board. `isExecutiveOrLeadership` already covers the structured
  // `executiveRole` field, the SUPER_ADMIN role and whole-word designations.
  if (isExecutiveOrLeadership(emp)) return TIER_EXECUTIVE;

  const role = String(emp.role || '').toUpperCase();
  if (role === 'HR_ADMIN') return TIER_HR;
  if (role === 'PROJECT_MANAGER') return TIER_PM;
  return TIER_EMPLOYEE;
}

/**
 * May `reviewer` file a performance review about `subject`?
 *
 * Strictly-below, which yields exactly the intended matrix:
 *   CTO/CEO (5) → HR, PM, Employee      but not each other
 *   HR      (3) → PM, Employee
 *   PM      (2) → Employee              but NOT another PM
 *   Employee(1) → nobody
 *
 * The identity guard is separate from the tier test because two people can share
 * a tier: without it a PM could review a peer PM, and the tier test alone would
 * not stop someone from reviewing themselves if they were ever the only person
 * on a tier above another.
 */
export function canReview(reviewer: any, subject: any): boolean {
  if (!reviewer || !subject) return false;
  if (isSamePerson(reviewer, subject)) return false;
  if (String(subject.status || '') === 'Terminated') return false;
  return tierOf(subject) < tierOf(reviewer);
}

/**
 * May a viewer read a review whose subject sat on `subjectTier`?
 *
 * Mirrors the `allow read` rule. `subjectTier` is read off the DOCUMENT, not
 * recomputed from the directory, so a review stays visible to the tier that was
 * entitled to it when it was written even if the subject is later promoted.
 *
 * Authorship and subjecthood are handled by the caller: they are properties of
 * the specific document, not of the tier relationship.
 */
export function canViewTier(viewerTier: number, subjectTier: number): boolean {
  // Executive board and HR hold the full appraisal record for compliance.
  if (viewerTier >= TIER_HR) return true;
  // A PM sees the workforce they manage, and no peer or superior.
  if (viewerTier === TIER_PM) return subjectTier === TIER_EMPLOYEE;
  return false;
}

/**
 * Identity across the two ways /employees is keyed: real accounts by Firebase
 * uid, the seeded ones by a synthetic `emp-KSS…` document id, with the bare
 * employee code carried separately. Comparing only `id` misses half the
 * directory.
 */
export function isSamePerson(a: any, b: any): boolean {
  if (!a || !b) return false;
  const ids = [a.id, a.uid, a.employeeId].filter(Boolean);
  const others = [b.id, b.uid, b.employeeId].filter(Boolean);
  return ids.some(x => others.includes(x));
}

/** Human-readable tier name, for badges and audit copy. */
export function tierLabel(tier: number): string {
  if (tier >= TIER_EXECUTIVE) return 'Executive Board';
  if (tier === TIER_HR) return 'HR';
  if (tier === TIER_PM) return 'Project Manager';
  return 'Employee';
}
