/**
 * Sends due-date reminder emails. Runs as a plain Node script on a schedule
 * (see .github/workflows/task-reminders.yml) — deliberately NOT a Firebase
 * Cloud Function, since scheduled functions and the "Trigger Email" extension
 * both require the Blaze plan. This needs no Firebase billing plan at all:
 * firebase-admin reads/writes Firestore for free regardless of plan: Blaze
 * is only required for Cloud Functions/Scheduler themselves, not for using
 * the Admin SDK from an external environment like GitHub Actions.
 *
 * ── Local setup ────────────────────────────────────────────────────────
 * 1. npm install firebase-admin nodemailer --save-dev
 * 2. Firebase Console → Project Settings → Service Accounts → Generate new
 *    private key → save as scripts/serviceAccountKey.json (gitignored)
 * 3. Get free SMTP credentials — see functions/README.md replacement notes,
 *    or just use Brevo (brevo.com, free tier, 300 emails/day, no card
 *    needed) or a Gmail App Password.
 * 4. Create a .env file (gitignored) in the project root with:
 *      SMTP_HOST=smtp-relay.brevo.com
 *      SMTP_PORT=587
 *      SMTP_USER=your-brevo-login
 *      SMTP_PASS=your-brevo-smtp-key
 *      MAIL_FROM="Xponet <noreply@exponentbizolution.org>"
 * 5. node scripts/send-task-reminders.mjs
 *
 * ── GitHub Actions (production schedule) ──────────────────────────────
 * Add these as repo secrets (Settings → Secrets and variables → Actions):
 *   FIREBASE_SERVICE_ACCOUNT_JSON  (paste the whole service account JSON)
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
 * The workflow in .github/workflows/task-reminders.yml runs this hourly.
 */

import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

// ── Credentials: env var (CI) takes priority, falls back to local file ──
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
  const localPath = new URL('./serviceAccountKey.json', import.meta.url);
  if (!existsSync(localPath)) {
    console.error(
      '\n✗ No Firebase credentials found.\n' +
      '  Locally: save a service account key at scripts/serviceAccountKey.json\n' +
      '  In CI: set the FIREBASE_SERVICE_ACCOUNT_JSON secret\n',
    );
    process.exit(1);
  }
  serviceAccount = JSON.parse(readFileSync(localPath, 'utf8'));
}

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
  console.error('\n✗ Missing SMTP_HOST / SMTP_USER / SMTP_PASS / MAIL_FROM environment variables.\n');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore('xponet'); // named database, matches src/lib/firebase.js

// Default end-of-business deadline for hour-based reminders: 17:00 Lusaka
// (CAT, UTC+2). Orgs can override via reminder_configs.eob_hour_utc.
const DEFAULT_EOB_HOUR_UTC = 15;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: Number(SMTP_PORT) === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function getTaskAssignees(task) {
  if (Array.isArray(task.assignees) && task.assignees.length > 0) return task.assignees;
  if (task.assignee_email) return [{ email: task.assignee_email, name: task.assignee_name || '' }];
  return [];
}

function describeWhen(diffDays) {
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 0) return `${Math.abs(diffDays)} day(s) ago`;
  return `in ${diffDays} days`;
}

async function sendReminderEmail(task, assignee, { diffDays, diffHours }, orgName) {
  const when = diffHours != null
    ? `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`
    : describeWhen(diffDays);
  const subject = diffHours != null
    ? `Due ${when}: ${task.title}`
    : diffDays === 0
      ? `Due today: ${task.title}`
      : diffDays === 1
        ? `Due tomorrow: ${task.title}`
        : `Due ${when}: ${task.title}`;

  await transporter.sendMail({
    from: MAIL_FROM,
    to: assignee.email,
    subject,
    html: `
      <p>Hi ${escapeHtml(assignee.name || '')},</p>
      <p>Your task <strong>${escapeHtml(task.title)}</strong>${orgName ? ` in <strong>${escapeHtml(orgName)}</strong>` : ''} is due ${when} (${task.due_date}).</p>
      ${task.priority ? `<p>Priority: ${escapeHtml(task.priority)}</p>` : ''}
      ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ''}
      <p style="color:#888;font-size:12px;margin-top:24px;">This is an automated reminder from Xponet. You're receiving it because you're assigned to this task.</p>
    `,
  });
}

async function run() {
  const now = new Date();
  const currentUtcHour = now.getUTCHours();
  const todayStr = now.toISOString().slice(0, 10);

  const configsSnap = await db.collection('reminder_configs').where('enabled', '==', true).get();
  console.log(`Reminder check (${now.toISOString()}): ${configsSnap.size} org(s) have reminders enabled.`);

  let totalEmails = 0;

  for (const configDoc of configsSnap.docs) {
    const config = configDoc.data();
    const targetHour = config.send_hour_utc ?? 8;

    // Day-based offsets fire only at the org's configured send hour; hour-based
    // offsets count down to the deadline, so they're checked on every hourly run.
    const dayOffsets = targetHour === currentUtcHour
      ? (Array.isArray(config.offsets_days) ? config.offsets_days : [1])
      : [];
    const hourOffsets = Array.isArray(config.offsets_hours) ? config.offsets_hours : [];
    if (dayOffsets.length === 0 && hourOffsets.length === 0) continue;

    const orgId = config.org_id || configDoc.id;

    const [orgSnap, tasksSnap] = await Promise.all([
      db.collection('organizations').doc(orgId).get(),
      db.collection('tasks').where('org_id', '==', orgId).get(),
    ]);
    const orgName = orgSnap.exists ? orgSnap.data().name : '';

    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data();
      if (!task.due_date || task.status === 'Done') continue;

      const assignees = getTaskAssignees(task);
      if (assignees.length === 0) continue;

      const due = new Date(`${task.due_date}T00:00:00Z`);
      const diffDays = Math.round((due - new Date(`${todayStr}T00:00:00Z`)) / 86400000);
      // The deadline moment is end of business on the due date (per-org
      // configurable; defaults to 17:00 Lusaka = 15:00 UTC).
      const eobHourUtc = Number.isFinite(config.eob_hour_utc)
        ? config.eob_hour_utc
        : DEFAULT_EOB_HOUR_UTC;
      const dueMoment = due.getTime() + eobHourUtc * 3600000;
      const diffHours = Math.round((dueMoment - now.getTime()) / 3600000);

      const matches = [];
      if (dayOffsets.includes(diffDays)) {
        matches.push({ marker: `${diffDays}:${task.due_date}`, timing: { diffDays }, log: `offset ${diffDays}d` });
      }
      if (hourOffsets.includes(diffHours)) {
        matches.push({ marker: `h${diffHours}:${task.due_date}`, timing: { diffHours }, log: `offset ${diffHours}h` });
      }

      for (const match of matches) {
        if ((task.reminders_sent || []).includes(match.marker)) continue;

        for (const assignee of assignees) {
          if (!assignee.email) continue;
          try {
            await sendReminderEmail(task, assignee, match.timing, orgName);
            totalEmails++;
          } catch (err) {
            console.error(`  ✗ Failed to email ${assignee.email} for task "${task.title}": ${err.message}`);
          }
        }

        await taskDoc.ref.update({ reminders_sent: FieldValue.arrayUnion(match.marker) });
        console.log(`  ✓ Reminder sent for "${task.title}" (${taskDoc.id}) — ${assignees.length} assignee(s), ${match.log}.`);
      }
    }
  }

  console.log(`Done. ${totalEmails} email(s) sent.`);
}

/**
 * Drains the `mail` collection — the outbound queue that the web client
 * enqueues into (e.g. workspace invitation emails; see firestore.rules).
 * Docs are marked sent (or errored) rather than deleted, for auditability.
 */
async function flushMailQueue() {
  const pendingSnap = await db.collection('mail').where('status', '==', 'pending').get();
  if (pendingSnap.empty) {
    console.log('Mail queue: empty.');
    return;
  }
  console.log(`Mail queue: ${pendingSnap.size} message(s) to send.`);

  for (const mailDoc of pendingSnap.docs) {
    const mail = mailDoc.data();
    try {
      await transporter.sendMail({
        from: MAIL_FROM,
        to: mail.to,
        subject: mail.subject,
        text: mail.text || undefined,
        html: mail.html || undefined,
      });
      await mailDoc.ref.update({ status: 'sent', sent_at: FieldValue.serverTimestamp() });
      console.log(`  ✓ Sent "${mail.subject}" to ${mail.to}`);
    } catch (err) {
      await mailDoc.ref.update({
        status: 'error',
        error: String(err.message || err),
        errored_at: FieldValue.serverTimestamp(),
      });
      console.error(`  ✗ Failed "${mail.subject}" to ${mail.to}: ${err.message}`);
    }
  }
}

await run();
await flushMailQueue();
process.exit(0);
