// Central role & permission logic for Xponet's three-tier RBAC:
// admin > supervisor > member.

export const ROLES = { ADMIN: 'admin', SUPERVISOR: 'supervisor', MEMBER: 'member' };
export const ROLE_LABELS = { admin: 'Admin', supervisor: 'Supervisor', member: 'Member' };
export const ASSIGNABLE_ROLES = [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MEMBER];

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
