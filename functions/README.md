# Xponet Cloud Functions — Workspace AI Agent

`workspaceAgent` is a v2 callable function. A signed-in user sends a
natural-language request + their `orgId`; Gemini turns it into tool calls that
create real pages / tasks / databases / records in the **`xponet`** Firestore
database, scoped to that org.

The client side (`src/components/AgentBar.jsx`, the "Ask AI" bar / ⌘J) is already
wired up and ships with the normal frontend build. What remains is deploying the
function.

## One-time setup

> ⚠️ **Cloud Functions v2 requires the Firebase Blaze (pay-as-you-go) plan.**
> This is the same reason the email/reminder pipeline was built on GitHub Actions
> instead. Blaze has a large free tier (≈2M invocations/month), so a small team
> realistically pays ~$0 — but it does require a billing card on the project.
> If you'd rather not enable billing, the alternative is a small Node endpoint on
> the existing GCP VM (ask and I'll build it); the agent logic ports directly.

1. **Enable Blaze** — Firebase console → project `xponet-f6f56` → upgrade plan.
2. **Get a Gemini API key** — https://aistudio.google.com/apikey (free tier, no card).
3. **Store the key as a secret** (never in code / .env / client):
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```
4. **Deploy** (from the repo root — `firebase.json` already points at `functions/`):
   ```bash
   firebase deploy --only functions:workspaceAgent
   ```
   The build installs `functions/package.json` deps in the cloud automatically.

That's it. Reload the app and the **Ask AI** button (bottom-right, or ⌘/Ctrl+J)
will call the live function.

## Notes

- **Region:** deploys to `us-central1` by default, which is what the client
  (`getFunctions(app)` in `src/lib/firebase.js`) expects. If you pin a different
  region on the function, pass it to `getFunctions(app, '<region>')` too.
- **Model:** `AGENT_MODEL` in `agent.js` — `gemini-2.5-flash` (default) or
  `gemini-2.5-flash-lite` for cheaper/faster simple intents.
- **Auth:** the Admin SDK bypasses Firestore rules, so `loadMembership()` is the
  only authorization — it rejects any `orgId` the caller isn't a member of.
- **Extending:** one entry in `TOOLS` + one function in `HANDLERS` with the same
  name. Good next tools: `update_task_status`, `search_pages` (dedupe before
  creating), `create_view`.
- **Logs:** `npm run logs` (in `functions/`) or `firebase functions:log`.
