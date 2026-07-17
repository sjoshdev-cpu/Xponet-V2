/**
 * Xponet Agent Server
 * -------------------
 * A tiny Express service that runs the workspace AI agent WITHOUT Firebase
 * Cloud Functions (so no Blaze plan). It runs:
 *   - locally during dev (Vite proxies /api -> here), and
 *   - on the GCP VM in production (nginx proxies /api -> here).
 *
 * Auth: the browser sends the signed-in user's Firebase ID token as
 * `Authorization: Bearer <token>`. We verify it with the Admin SDK, so
 * req.user.email is trustworthy — that's what the org-membership check relies
 * on. The Admin SDK bypasses Firestore security rules, so that check is the
 * only thing standing between a caller and an org's data.
 *
 * Config (env / server/.env):
 *   GEMINI_API_KEY            required — from https://aistudio.google.com/apikey
 *   SERVICE_ACCOUNT_PATH      path to the Firebase service-account JSON
 *                             (default ./serviceAccountKey.json)
 *   FIRESTORE_DATABASE_ID     Firestore database id (default 'xponet')
 *   AGENT_MODEL               'gemini-2.5-flash' (default) | 'gemini-2.5-flash-lite'
 *   PORT                      default 8787
 *   ALLOWED_ORIGIN            CORS origin allowlist (default: reflect request)
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { runAgent, loadMembership } = require('./agent-core');

const {
  GEMINI_API_KEY,
  SERVICE_ACCOUNT_PATH = './serviceAccountKey.json',
  FIRESTORE_DATABASE_ID = 'xponet',
  AGENT_MODEL = 'gemini-2.5-flash',
  PORT = 8787,
  ALLOWED_ORIGIN,
} = process.env;

// Note: we DON'T exit when GEMINI_API_KEY is missing. Exiting leaves the port
// closed, which the Vite/nginx proxy surfaces as an opaque 502 Bad Gateway.
// Instead the server stays up, the health check works, and the /api/agent
// endpoint returns a clear "not configured" error you can actually act on.
if (!GEMINI_API_KEY) {
  console.warn('⚠ GEMINI_API_KEY is not set — /api/agent will return a config error until you set it in server/.env.');
}

// ── Firebase Admin init ────────────────────────────────────────────────────
// Prefer an explicit service-account file; fall back to Application Default
// Credentials (e.g. GOOGLE_APPLICATION_CREDENTIALS or a GCE metadata identity).
let credential;
try {
  const saPath = path.resolve(__dirname, SERVICE_ACCOUNT_PATH);
  credential = admin.credential.cert(require(saPath));
} catch {
  credential = admin.credential.applicationDefault();
}
admin.initializeApp({ credential });
const db = getFirestore(FIRESTORE_DATABASE_ID);

// ── Express ────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(cors({ origin: ALLOWED_ORIGIN || true })); // reflect origin if unset

app.get('/api/agent/health', (_req, res) => res.json({ ok: true }));

// Verify the Firebase ID token on every agent call.
async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in required.' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.email) return res.status(403).json({ error: 'No email on the signed-in account.' });
    req.user = { email: decoded.email, name: decoded.name || decoded.email, uid: decoded.uid };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

// Config guard runs before auth so a missing key gives a clear message no
// matter the token/credential state — the common "why won't the chat work".
function requireConfig(_req, res, next) {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Assistant is not configured: set GEMINI_API_KEY in server/.env and restart the agent server.' });
  }
  next();
}

app.post('/api/agent', requireConfig, requireAuth, async (req, res) => {
  const { message, orgId } = req.body || {};
  if (!message || !orgId) return res.status(400).json({ error: 'message and orgId are required.' });

  try {
    const { memberNames } = await loadMembership(db, orgId, req.user.email);
    const ctx = { orgId, user: req.user, memberNames };
    const { reply, actions } = await runAgent({
      db, apiKey: GEMINI_API_KEY, model: AGENT_MODEL, message, ctx,
    });
    res.json({ reply, actions });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[agent]', err);
    res.status(status).json({ error: err.message || 'The assistant could not complete that request.' });
  }
});

app.listen(PORT, () => {
  console.log(`✓ Xponet agent server on :${PORT} (db='${FIRESTORE_DATABASE_ID}', model='${AGENT_MODEL}')`);
});
