// Central role & permission logic for Xponet's three-tier RBAC:
// admin > supervisor > member.

export const ROLES = { ADMIN: 'admin', SUPERVISOR: 'supervisor', MEMBER: 'member' };
export const ROLE_LABELS = { admin: 'Admin', supervisor: 'Supervisor', member: 'Member' };
export const ASSIGNABLE_ROLES = [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MEMBER];

/**
 * Optional per-member `dashboard_role` (a field on each entry in an org's
 * `members` array). It's orthogonal to the RBAC `role` above: RBAC controls
 * what you can *do*, dashboard_role controls which department dashboard nav
 * link a member sees. Firestore is schemaless, so "adding" this field just
 * means writing it on members and reading it here — no migration needed, and
 * members without it simply see no department dashboard link.
 */
export const DASHBOARD_ROLES = {
  FINANCE: 'finance',
  LEGAL: 'legal',
  CALL_CENTER_HEAD: 'call_center_head',
  CALL_CENTER_SUPERVISOR: 'call_center_supervisor',
  BACK_OFFICE_MANAGER: 'back_office_manager',
  ENGINEERING: 'engineering',
  MIS_ANALYST: 'mis_analyst',
  TRADE_OPS_HEAD: 'trade_ops_head',
  TRADE_OPS_ANALYST: 'trade_ops_analyst',
};

export const DASHBOARD_ROLE_LABELS = {
  finance: 'Finance',
  legal: 'Legal',
  call_center_head: 'Call Center — Head',
  call_center_supervisor: 'Call Center — Supervisor',
  back_office_manager: 'Back Office Manager',
  engineering: 'Engineering',
  mis_analyst: 'MIS Analyst',
  trade_ops_head: 'Trade Ops — Head',
  trade_ops_analyst: 'Trade Ops — Analyst',
};

export const ASSIGNABLE_DASHBOARD_ROLES = Object.values(DASHBOARD_ROLES);

/** The member's dashboard_role within an org, or null. */
export function getDashboardRole(org, email) {
  if (!org || !email) return null;
  return (org.members || []).find((m) => m.email === email)?.dashboard_role || null;
}

/**
 * canAccessDashboard(org, email, allowed) — gate a department dashboard nav
 * link / route. `allowed` is a dashboard_role or array of them. Org admins
 * always pass (they can see every dashboard); otherwise the member's own
 * dashboard_role must be in `allowed`.
 */
export function canAccessDashboard(org, email, allowed) {
  if (!org || !email) return false;
  if (getRole(org, email) === ROLES.ADMIN) return true;
  const mine = getDashboardRole(org, email);
  if (!mine) return false;
  const list = Array.isArray(allowed) ? allowed : [allowed];
  return list.includes(mine);
}

/** Looks up a user's role within an org. Org owner always counts as admin. */
export function getRole(org, email) {
  if (!org || !email) return null;
  if (org.owner_email === email) return ROLES.ADMIN;
  return (org.members || []).find((m) => m.email === email)?.role || null;
}

/** Admins and supervisors see every task in the org; members see their own. */
export function canViewAllTasks(role) {
  return role === ROLES.ADMIN || role === ROLES.SUPERVISOR;
}

/** Command Center is restricted to admins and supervisors. */
export function canAccessCommandCenter(role) {
  return role === ROLES.ADMIN || role === ROLES.SUPERVISOR;
}

/** Who can see the Members management panel at all. */
export function canManageMembers(role) {
  return role === ROLES.ADMIN || role === ROLES.SUPERVISOR;
}

/**
 * Can `actorRole` change a member currently at `targetRole` to `newRole`?
 *  - admin:      unrestricted — can set anyone to admin, supervisor, or member.
 *  - supervisor: can only promote a plain member up to supervisor. Cannot
 *                touch admins or other supervisors, and cannot grant admin.
 *  - member:     cannot change anyone's role, including their own.
 */
export function canChangeRole(actorRole, targetRole, newRole) {
  if (actorRole === ROLES.ADMIN) return true;
  if (actorRole === ROLES.SUPERVISOR) {
    return targetRole === ROLES.MEMBER && newRole === ROLES.SUPERVISOR;
  }
  return false;
}

/**
 * Builds the fields to persist whenever an org's member list changes.
 * `memberEmails` and `memberRoles` are flat, rules-friendly projections of
 * `members` that Firestore security rules rely on — always derive them here
 * rather than writing `members` directly, so they can never drift out of sync.
 */
export function buildMemberFields(members) {
  const list = members || [];
  const memberEmails = list.map((m) => m.email).filter(Boolean);
  const memberRoles = {};
  list.forEach((m) => { if (m.email) memberRoles[m.email] = m.role; });
  return { members: list, memberEmails, memberRoles };
}

/**
 * Same idea for pending invitations: `pending_invites` is the rich list shown
 * in Settings, while `pendingInviteEmails` / `pendingInviteRoles` are the flat
 * projections the security rules check when an invitee reads the org or
 * accepts their invite. Invitees are NOT members — they gain no access until
 * they accept and are moved into the member fields.
 */
export function buildInviteFields(invites) {
  const list = invites || [];
  const pendingInviteEmails = list.map((i) => i.email).filter(Boolean);
  const pendingInviteRoles = {};
  list.forEach((i) => { if (i.email) pendingInviteRoles[i.email] = i.role; });
  return { pending_invites: list, pendingInviteEmails, pendingInviteRoles };
}
