import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Organization, Page } from '@/api/firestoreClient';
import { seedDocumentHub } from '@/api/seedDocumentHub';
import { buildMemberFields, buildInviteFields, getRole } from '@/lib/permissions';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { user: firebaseUser } = useAuth();
  // Normalize Firebase user to match the shape expected by consuming components
  const user = firebaseUser ? {
    email: firebaseUser.email,
    full_name: firebaseUser.displayName || '',
    uid: firebaseUser.uid,
  } : null;

  const [currentOrg, setCurrentOrg] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]); // orgs inviting this user
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [theme, setThemeState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('xponet-theme') || 'system';
    }
    return 'system';
  });

  const setTheme = useCallback((t) => {
    setThemeState(t);
    localStorage.setItem('xponet-theme', t);
    const root = document.documentElement;
    if (t === 'dark') {
      root.classList.add('dark');
    } else if (t === 'light') {
      root.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, []);

  useEffect(() => {
    setTheme(theme);
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => setTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme, setTheme]);

  const initWorkspace = useCallback(async () => {
    if (!firebaseUser) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let [userOrgs, invitingOrgs] = await Promise.all([
      Organization.filter({ memberEmails: { arrayContains: firebaseUser.email } }),
      Organization.filter({ pendingInviteEmails: { arrayContains: firebaseUser.email } }),
    ]);
    setPendingInvites(invitingOrgs);

    if (userOrgs.length === 0) {
      const newOrg = await Organization.create({
        name: `${firebaseUser.displayName || 'My'}'s Workspace`,
        icon: '🏠',
        owner_email: firebaseUser.email,
        ...buildMemberFields([{ email: firebaseUser.email, role: 'admin', full_name: firebaseUser.displayName || '' }]),
      });
      userOrgs = [newOrg];

      await Page.create({
        title: 'Getting Started with Xponet',
        icon: '👋',
        org_id: newOrg.id,
        is_shared: true,
        content: JSON.stringify([
          { id: '1', type: 'callout', emoji: '🎉', color: 'blue', content: 'Welcome to Xponet! Your collaborative workspace for notes, docs, and knowledge.' },
          { id: '2', type: 'heading1', content: 'Quick Start Guide' },
          { id: '3', type: 'todo', checked: false, content: 'Create your first page using the + button in the sidebar' },
          { id: '4', type: 'todo', checked: false, content: 'Try the slash (/) command to add different block types' },
          { id: '5', type: 'todo', checked: false, content: 'Invite team members from Settings' },
          { id: '6', type: 'todo', checked: false, content: 'Create a database to organize your work' },
          { id: '7', type: 'divider' },
          { id: '8', type: 'toggle', content: 'What can I do with Xponet?', children: [
            { id: '8a', type: 'paragraph', content: 'Create rich documents with text, images, code, and more.' },
            { id: '8b', type: 'paragraph', content: 'Build databases to track projects, tasks, and knowledge.' },
            { id: '8c', type: 'paragraph', content: 'Collaborate with your team in real-time.' }
          ]},
          { id: '9', type: 'paragraph', content: '' }
        ])
      });

      await Page.create({
        title: 'Quick Note',
        icon: '📝',
        org_id: newOrg.id,
        content: JSON.stringify([
          { id: '1', type: 'paragraph', content: 'Start typing here...' }
        ])
      });
    }

    setOrgs(userOrgs);
    const savedOrgId = localStorage.getItem('xponet-org');
    const activeOrg = userOrgs.find(o => o.id === savedOrgId) || userOrgs[0];
    setCurrentOrg(activeOrg);

    // Idempotently seed Document Hub for this org (no-op if already seeded)
    if (activeOrg) {
      await seedDocumentHub(activeOrg.id, firebaseUser.email);
    }

    setLoading(false);
  }, [firebaseUser]);

  useEffect(() => {
    initWorkspace();
  }, [initWorkspace]);

  const switchOrg = useCallback((org) => {
    setCurrentOrg(org);
    localStorage.setItem('xponet-org', org.id);
  }, []);

  const refreshOrgs = useCallback(async () => {
    if (!firebaseUser) return;
    const [userOrgs, invitingOrgs] = await Promise.all([
      Organization.filter({ memberEmails: { arrayContains: firebaseUser.email } }),
      Organization.filter({ pendingInviteEmails: { arrayContains: firebaseUser.email } }),
    ]);
    setOrgs(userOrgs);
    setPendingInvites(invitingOrgs);
    if (currentOrg) {
      const updated = userOrgs.find(o => o.id === currentOrg.id);
      if (updated) setCurrentOrg(updated);
    }
  }, [firebaseUser, currentOrg]);

  /**
   * Accept a workspace invitation: move self from the org's pending-invite
   * fields into the member fields, at exactly the invited role. The security
   * rules only permit this precise transition (see firestore.rules).
   */
  const acceptInvite = useCallback(async (org) => {
    const invite = (org.pending_invites || []).find(i => i.email === firebaseUser.email);
    if (!invite) return;
    const members = [
      ...(org.members || []),
      { email: firebaseUser.email, role: invite.role, full_name: firebaseUser.displayName || '' },
    ];
    const invites = (org.pending_invites || []).filter(i => i.email !== firebaseUser.email);
    await Organization.update(org.id, {
      ...buildMemberFields(members),
      ...buildInviteFields(invites),
    });
    setPendingInvites(prev => prev.filter(o => o.id !== org.id));
    await refreshOrgs();
  }, [firebaseUser, refreshOrgs]);

  /** Decline an invitation: remove self from the pending lists, nothing else. */
  const declineInvite = useCallback(async (org) => {
    const invites = (org.pending_invites || []).filter(i => i.email !== firebaseUser.email);
    await Organization.update(org.id, buildInviteFields(invites));
    setPendingInvites(prev => prev.filter(o => o.id !== org.id));
  }, [firebaseUser]);

  /** Create an additional workspace owned by the current user and switch to it. */
  const createWorkspace = useCallback(async (name, icon = '🏠') => {
    const newOrg = await Organization.create({
      name: name || `${firebaseUser.displayName || 'My'}'s Workspace`,
      icon,
      owner_email: firebaseUser.email,
      ...buildMemberFields([{ email: firebaseUser.email, role: 'admin', full_name: firebaseUser.displayName || '' }]),
    });
    setOrgs(prev => [...prev, newOrg]);
    setCurrentOrg(newOrg);
    localStorage.setItem('xponet-org', newOrg.id);
    return newOrg;
  }, [firebaseUser]);

  const role = getRole(currentOrg, user?.email);

  return (
    <WorkspaceContext.Provider value={{
      user, currentOrg, orgs, loading, role,
      pendingInvites, acceptInvite, declineInvite, createWorkspace,
      sidebarOpen, setSidebarOpen,
      theme, setTheme,
      switchOrg, refreshOrgs, initWorkspace
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}