import { describe, it, expect } from 'vitest';
import {
  ROLES,
  getRole,
  canViewAllTasks,
  canAccessCommandCenter,
  canChangeRole,
  buildMemberFields,
  buildInviteFields,
} from './permissions';

const org = {
  owner_email: 'owner@x.com',
  members: [
    { email: 'owner@x.com', role: 'admin' },
    { email: 'sup@x.com', role: 'supervisor' },
    { email: 'mem@x.com', role: 'member' },
  ],
};

describe('getRole', () => {
  it('owner is always admin', () => {
    expect(getRole({ ...org, members: [] }, 'owner@x.com')).toBe(ROLES.ADMIN);
  });
  it('reads role from members list', () => {
    expect(getRole(org, 'sup@x.com')).toBe(ROLES.SUPERVISOR);
    expect(getRole(org, 'mem@x.com')).toBe(ROLES.MEMBER);
  });
  it('unknown email or missing org yields null', () => {
    expect(getRole(org, 'nobody@x.com')).toBeNull();
    expect(getRole(null, 'mem@x.com')).toBeNull();
    expect(getRole(org, null)).toBeNull();
  });
});

describe('role gates', () => {
  it('admins and supervisors see all tasks; members do not', () => {
    expect(canViewAllTasks(ROLES.ADMIN)).toBe(true);
    expect(canViewAllTasks(ROLES.SUPERVISOR)).toBe(true);
    expect(canViewAllTasks(ROLES.MEMBER)).toBe(false);
  });
  it('command center is admin/supervisor only', () => {
    expect(canAccessCommandCenter(ROLES.ADMIN)).toBe(true);
    expect(canAccessCommandCenter(ROLES.SUPERVISOR)).toBe(true);
    expect(canAccessCommandCenter(ROLES.MEMBER)).toBe(false);
  });
});

describe('canChangeRole matrix', () => {
  it('admin can change anyone to anything', () => {
    for (const target of Object.values(ROLES)) {
      for (const next of Object.values(ROLES)) {
        expect(canChangeRole(ROLES.ADMIN, target, next)).toBe(true);
      }
    }
  });
  it('supervisor may only promote member -> supervisor', () => {
    expect(canChangeRole(ROLES.SUPERVISOR, ROLES.MEMBER, ROLES.SUPERVISOR)).toBe(true);
    expect(canChangeRole(ROLES.SUPERVISOR, ROLES.MEMBER, ROLES.ADMIN)).toBe(false);
    expect(canChangeRole(ROLES.SUPERVISOR, ROLES.SUPERVISOR, ROLES.MEMBER)).toBe(false);
    expect(canChangeRole(ROLES.SUPERVISOR, ROLES.ADMIN, ROLES.MEMBER)).toBe(false);
  });
  it('member can change nobody', () => {
    expect(canChangeRole(ROLES.MEMBER, ROLES.MEMBER, ROLES.SUPERVISOR)).toBe(false);
    expect(canChangeRole(ROLES.MEMBER, ROLES.MEMBER, ROLES.MEMBER)).toBe(false);
  });
});

describe('buildMemberFields', () => {
  it('derives flat projections used by security rules', () => {
    const fields = buildMemberFields(org.members);
    expect(fields.memberEmails).toEqual(['owner@x.com', 'sup@x.com', 'mem@x.com']);
    expect(fields.memberRoles['mem@x.com']).toBe('member');
    expect(fields.members).toHaveLength(3);
  });
  it('drops falsy emails and tolerates empty input', () => {
    expect(buildMemberFields([{ email: '', role: 'member' }]).memberEmails).toEqual([]);
    expect(buildMemberFields(null).memberEmails).toEqual([]);
  });
});

describe('buildInviteFields', () => {
  it('derives pending invite projections', () => {
    const fields = buildInviteFields([{ email: 'new@x.com', role: 'member' }]);
    expect(fields.pendingInviteEmails).toEqual(['new@x.com']);
    expect(fields.pendingInviteRoles['new@x.com']).toBe('member');
    expect(fields.pending_invites).toHaveLength(1);
  });
  it('empty invites clear the projections', () => {
    const fields = buildInviteFields([]);
    expect(fields.pendingInviteEmails).toEqual([]);
    expect(fields.pendingInviteRoles).toEqual({});
  });
});
