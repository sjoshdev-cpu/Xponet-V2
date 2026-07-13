/**
 * Firestore security-rules tests. Run inside the emulator:
 *   npm run test:rules
 *
 * Covers the authorization model's load-bearing guarantees:
 *  - org privilege escalation is impossible for members
 *  - invite acceptance is constrained to self + invited role
 *  - the mail queue is write-only for org members
 *  - presence is self-write-only
 */
import { readFileSync } from 'fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';

let testEnv;

const ADMIN = 'admin@x.com';
const SUPER = 'super@x.com';
const MEMBER = 'member@x.com';
const INVITEE = 'invitee@x.com';
const OUTSIDER = 'outsider@x.com';

const baseOrg = {
  name: 'Acme',
  owner_email: ADMIN,
  members: [
    { email: ADMIN, role: 'admin' },
    { email: SUPER, role: 'supervisor' },
    { email: MEMBER, role: 'member' },
  ],
  memberEmails: [ADMIN, SUPER, MEMBER],
  memberRoles: { [ADMIN]: 'admin', [SUPER]: 'supervisor', [MEMBER]: 'member' },
  pending_invites: [{ email: INVITEE, role: 'member', invited_by: ADMIN }],
  pendingInviteEmails: [INVITEE],
  pendingInviteRoles: { [INVITEE]: 'member' },
};

const db = (email) =>
  testEnv.authenticatedContext(email.replace(/[@.]/g, '_'), { email }).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-xponet',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc('organizations/org1').set(baseOrg);
    await ctx.firestore().doc('tasks/task1').set({
      org_id: 'org1',
      title: 'T',
      assignee_emails: [MEMBER],
    });
  });
});

describe('organizations — read access', () => {
  it('members and invitees can read; outsiders cannot', async () => {
    await assertSucceeds(db(MEMBER).doc('organizations/org1').get());
    await assertSucceeds(db(INVITEE).doc('organizations/org1').get());
    await assertFails(db(OUTSIDER).doc('organizations/org1').get());
  });

  it('membership and invite list queries are provable', async () => {
    await assertSucceeds(
      db(MEMBER).collection('organizations').where('memberEmails', 'array-contains', MEMBER).get(),
    );
    await assertSucceeds(
      db(INVITEE)
        .collection('organizations')
        .where('pendingInviteEmails', 'array-contains', INVITEE)
        .get(),
    );
  });
});

describe('organizations — privilege escalation (S1)', () => {
  it('a member CANNOT grant themselves admin', async () => {
    await assertFails(
      db(MEMBER).doc('organizations/org1').update({
        memberRoles: { ...baseOrg.memberRoles, [MEMBER]: 'admin' },
        members: baseOrg.members.map((m) =>
          m.email === MEMBER ? { ...m, role: 'admin' } : m,
        ),
      }),
    );
  });

  it('a member CANNOT remove another member', async () => {
    await assertFails(
      db(MEMBER).doc('organizations/org1').update({
        memberEmails: [ADMIN, MEMBER],
        members: baseOrg.members.filter((m) => m.email !== SUPER),
        memberRoles: { [ADMIN]: 'admin', [MEMBER]: 'member' },
      }),
    );
  });

  it('a member CANNOT forge or cancel invites', async () => {
    await assertFails(
      db(MEMBER).doc('organizations/org1').update({
        pending_invites: [],
        pendingInviteEmails: [],
        pendingInviteRoles: {},
      }),
    );
  });

  it('a member CAN update cosmetic fields', async () => {
    await assertSucceeds(db(MEMBER).doc('organizations/org1').update({ name: 'Acme Renamed' }));
  });

  it('an admin CAN manage membership', async () => {
    await assertSucceeds(
      db(ADMIN).doc('organizations/org1').update({
        memberRoles: { ...baseOrg.memberRoles, [MEMBER]: 'supervisor' },
        members: baseOrg.members.map((m) =>
          m.email === MEMBER ? { ...m, role: 'supervisor' } : m,
        ),
      }),
    );
  });

  it('an admin CANNOT remove themselves or reassign the owner', async () => {
    await assertFails(
      db(ADMIN).doc('organizations/org1').update({
        memberEmails: [SUPER, MEMBER],
      }),
    );
    await assertFails(
      db(ADMIN).doc('organizations/org1').update({ owner_email: MEMBER }),
    );
  });

  it('a supervisor CAN edit roles but CANNOT add people or change own role', async () => {
    await assertSucceeds(
      db(SUPER).doc('organizations/org1').update({
        memberRoles: { ...baseOrg.memberRoles, [MEMBER]: 'supervisor' },
      }),
    );
    await assertFails(
      db(SUPER).doc('organizations/org1').update({
        memberEmails: [...baseOrg.memberEmails, 'friend@x.com'],
      }),
    );
    await assertFails(
      db(SUPER).doc('organizations/org1').update({
        memberRoles: { ...baseOrg.memberRoles, [SUPER]: 'admin' },
      }),
    );
  });
});

describe('organizations — invite acceptance', () => {
  const acceptance = () => ({
    members: [...baseOrg.members, { email: INVITEE, role: 'member', full_name: '' }],
    memberEmails: [...baseOrg.memberEmails, INVITEE],
    memberRoles: { ...baseOrg.memberRoles, [INVITEE]: 'member' },
    pending_invites: [],
    pendingInviteEmails: [],
    pendingInviteRoles: {},
  });

  it('an invitee CAN accept at the invited role', async () => {
    await assertSucceeds(db(INVITEE).doc('organizations/org1').update(acceptance()));
  });

  it('an invitee CANNOT join as admin', async () => {
    const esc = acceptance();
    esc.memberRoles[INVITEE] = 'admin';
    await assertFails(db(INVITEE).doc('organizations/org1').update(esc));
  });

  it('an invitee CANNOT add anyone but themselves', async () => {
    const esc = acceptance();
    esc.memberEmails = [...esc.memberEmails, 'friend@x.com'];
    await assertFails(db(INVITEE).doc('organizations/org1').update(esc));
  });

  it('an invitee CAN decline (pending lists shrink, membership unchanged)', async () => {
    await assertSucceeds(
      db(INVITEE).doc('organizations/org1').update({
        pending_invites: [],
        pendingInviteEmails: [],
        pendingInviteRoles: {},
      }),
    );
  });

  it('an outsider CANNOT touch the org', async () => {
    await assertFails(db(OUTSIDER).doc('organizations/org1').update({ name: 'pwned' }));
  });
});

describe('mail queue', () => {
  const mailDoc = {
    org_id: 'org1',
    to: 'someone@x.com',
    subject: 'Hi',
    text: 'Body',
    status: 'pending',
  };

  it('an org member can enqueue mail', async () => {
    await assertSucceeds(db(MEMBER).collection('mail').add(mailDoc));
  });

  it('an outsider cannot enqueue; nobody can read', async () => {
    await assertFails(db(OUTSIDER).collection('mail').add(mailDoc));
    await assertFails(db(ADMIN).collection('mail').get());
  });

  it('required fields are enforced', async () => {
    await assertFails(db(MEMBER).collection('mail').add({ org_id: 'org1', to: 'a@x.com' }));
  });
});

describe('tasks', () => {
  it('assignee-filtered member query is provable; unfiltered is rejected', async () => {
    await assertSucceeds(
      db(MEMBER)
        .collection('tasks')
        .where('org_id', '==', 'org1')
        .where('assignee_emails', 'array-contains', MEMBER)
        .get(),
    );
    await assertFails(db(OUTSIDER).collection('tasks').where('org_id', '==', 'org1').get());
  });
});

describe('presence', () => {
  it('users may write only their own presence doc', async () => {
    const uid = MEMBER.replace(/[@.]/g, '_');
    await assertSucceeds(
      db(MEMBER).doc(`presence/org1/page/p1/users/${uid}`).set({ lastSeen: new Date() }),
    );
    await assertFails(
      db(MEMBER).doc('presence/org1/page/p1/users/someone_else').set({ lastSeen: new Date() }),
    );
  });
});
