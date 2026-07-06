/**
 * One-time backfill for the RBAC + multi-assignee changes.
 *
 * Fixes two classes of existing documents that predate this work and are
 * missing fields the new firestore.rules depend on:
 *
 *   1. organizations/{id} — needs `memberEmails` (flat array) and
 *      `memberRoles` (email -> role map), derived from `members[]`.
 *      WITHOUT THIS, deploying the new firestore.rules locks every existing
 *      user out of every collection immediately — isOrgMember() checks
 *      memberEmails, which older org docs never had set.
 *
 *   2. tasks/{id} — needs `assignees` and `assignee_emails`, derived from
 *      the legacy singular `assignee_email` / `assignee_name` fields.
 *      Without this, existing tasks are invisible to their own assignee
 *      once the role-based visibility rule goes live (the rule checks
 *      assignee_emails, which old tasks don't have).
 *
 * Safe to run multiple times — already-migrated documents are skipped.
 *
 * ── Setup ──────────────────────────────────────────────────────────────
 * 1. npm install firebase-admin --save-dev   (not needed at runtime, only
 *    for running this script — do not ship it to the browser bundle)
 *
 * 2. Get a service account key:
 *    Firebase Console → Project Settings → Service Accounts →
 *    "Generate new private key" → save as scripts/serviceAccountKey.json
 *    (this repo's .gitignore should already exclude it — double check
 *    before committing anything)
 *
 * ── Usage ──────────────────────────────────────────────────────────────
 *   node scripts/migrate-rbac-and-assignees.mjs            # dry run — reports only
 *   node scripts/migrate-rbac-and-assignees.mjs --commit    # actually writes changes
 *
 * Run the dry run first and read the output before committing.
 */

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COMMIT = process.argv.includes('--commit');
const SERVICE_ACCOUNT_PATH = new URL('./serviceAccountKey.json', import.meta.url);

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
} catch (err) {
  console.error(
    '\n✗ Could not read scripts/serviceAccountKey.json.\n' +
    '  Download one from Firebase Console → Project Settings → Service Accounts\n' +
    '  → Generate new private key, and save it at that exact path.\n',
  );
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });

// Xponet uses a named Firestore database ("xponet"), not the (default) one —
// matches the getFirestore(app, "xponet") call in src/lib/firebase.js.
const db = getFirestore('xponet');

console.log(COMMIT ? '⚠ Running in COMMIT mode — writes will be applied.\n' : 'ℹ Dry run — no writes will be made. Pass --commit to apply.\n');

function buildMemberFields(members) {
  const list = members || [];
  const memberEmails = list.map((m) => m.email).filter(Boolean);
  const memberRoles = {};
  list.forEach((m) => { if (m.email) memberRoles[m.email] = m.role; });
  return { members: list, memberEmails, memberRoles };
}

function buildAssigneeFields(task) {
  // Already migrated and consistent — nothing to do.
  if (Array.isArray(task.assignees) && task.assignees.length > 0 && Array.isArray(task.assignee_emails)) {
    return null;
  }
  const assignees = Array.isArray(task.assignees) && task.assignees.length > 0
    ? task.assignees
    : (task.assignee_email ? [{ email: task.assignee_email, name: task.assignee_name || '' }] : []);

  if (assignees.length === 0) return null; // genuinely unassigned, nothing to backfill

  return {
    assignees,
    assignee_emails: assignees.map((a) => a.email).filter(Boolean),
  };
}

async function migrateOrganizations() {
  console.log('── Organizations ──────────────────────────────');
  const snapshot = await db.collection('organizations').get();
  let batch = db.batch();
  let pending = 0;
  let changed = 0;

  for (const doc of snapshot.docs) {
    const org = doc.data();
    const needsFix =
      !Array.isArray(org.memberEmails) ||
      !org.memberRoles ||
      org.memberEmails.length !== (org.members || []).length;

    if (!needsFix) continue;

    changed++;
    const fields = buildMemberFields(org.members);
    console.log(`  ${doc.id} (${org.name || 'unnamed'}): backfilling ${fields.memberEmails.length} member(s)`);

    if (COMMIT) {
      batch.update(doc.ref, { memberEmails: fields.memberEmails, memberRoles: fields.memberRoles });
      pending++;
      if (pending >= 400) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
  }
  if (COMMIT && pending > 0) await batch.commit();
  console.log(`  ${changed} organization(s) ${COMMIT ? 'updated' : 'would be updated'}.\n`);
}

async function migrateTasks() {
  console.log('── Tasks ───────────────────────────────────────');
  const snapshot = await db.collection('tasks').get();
  let batch = db.batch();
  let pending = 0;
  let changed = 0;
  let skippedUnassigned = 0;

  for (const doc of snapshot.docs) {
    const task = doc.data();
    const fields = buildAssigneeFields(task);
    if (!fields) {
      if (!task.assignee_email && !(task.assignees || []).length) skippedUnassigned++;
      continue;
    }

    changed++;
    if (changed <= 20) {
      console.log(`  ${doc.id} ("${(task.title || '').slice(0, 40)}"): -> ${fields.assignee_emails.join(', ')}`);
    }

    if (COMMIT) {
      batch.update(doc.ref, fields);
      pending++;
      if (pending >= 400) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
  }
  if (COMMIT && pending > 0) await batch.commit();
  if (changed > 20) console.log(`  ...and ${changed - 20} more.`);
  console.log(`  ${changed} task(s) ${COMMIT ? 'updated' : 'would be updated'}. ${skippedUnassigned} unassigned task(s) skipped.\n`);
}

await migrateOrganizations();
await migrateTasks();

console.log(COMMIT
  ? '✓ Migration complete.'
  : '✓ Dry run complete. Re-run with --commit to apply these changes.');

process.exit(0);
