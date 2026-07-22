# Xponet Agent Server (no Blaze plan)

Runs the workspace AI agent as a small Node service instead of a Firebase Cloud
Function — so **no Blaze/billing upgrade is needed**. Same agent logic; it just
talks HTTP and verifies the Firebase ID token itself.

- **Dev:** Vite proxies `/api` → `localhost:8787` (this server).
- **Prod:** nginx on the VM proxies `/api` → `localhost:8787` (this server).

The client always calls the relative path `/api/agent`, so nothing about the
frontend changes between environments.

```
Browser (AgentBar) ──POST /api/agent (Bearer ID token)──▶ this server
                                                          │ verifyIdToken()
                                                          │ membership check
                                                          │ Gemini tool loop
                                                          ▼
                                            Firestore 'xponet' (Admin SDK)
```

## Prerequisites (both environments)

1. **Gemini API key** — https://aistudio.google.com/apikey (free tier, no card).
2. **Firebase service-account key** — Firebase Console → Project Settings →
   Service accounts → *Generate new private key*. Save it as
   `server/serviceAccountKey.json` (gitignored). This is a full-admin
   credential — never commit it. *(You already have one downloaded; you can
   copy that file here.)*
3. **Config** — `cp server/.env.example server/.env` and set `GEMINI_API_KEY`.

## Run locally

Two terminals:

```bash
# terminal 1 — the agent server
cd server
npm install
npm run dev          # nodemon-style reload; listens on :8787

# terminal 2 — the app (as usual)
npm run dev          # Vite on :5173, proxies /api -> :8787
```

Open the app, click **Ask AI** (bottom-right) or press **⌘/Ctrl+J**. A quick
health check: `curl http://localhost:8787/api/agent/health` → `{"ok":true}`.

## Deploy on the GCP VM

The app already lives at `~/Xponet-V2` on the VM behind nginx. Run the agent as
a systemd service and add one nginx location block.

```bash
# 1. Pull, install server deps
cd ~/Xponet-V2 && git pull
cd server && npm install --omit=dev

# 2. Config + service-account key (both gitignored — create on the VM)
cp .env.example .env && nano .env          # set GEMINI_API_KEY
nano serviceAccountKey.json                # paste the service-account JSON

# 3. Install & start the service
sudo cp xponet-agent.service /etc/systemd/system/
#   check User=/WorkingDirectory= in the unit match your VM paths first
sudo systemctl daemon-reload
sudo systemctl enable --now xponet-agent
sudo systemctl status xponet-agent          # should be active (running)

# 4. Proxy /api -> the service, inside your existing HTTPS server block
#    (/etc/nginx/sites-available/xponet). Add:
#
#      location /api/ {
#          proxy_pass http://127.0.0.1:8787;
#          proxy_set_header Host $host;
#          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#          proxy_read_timeout 120s;   # Gemini multi-tool runs can take a bit
#      }
#
sudo nginx -t && sudo systemctl reload nginx
```

Update after code changes: `cd ~/Xponet-V2 && git pull && cd server &&
npm install --omit=dev && sudo systemctl restart xponet-agent`.

## Config reference

| Env var | Default | Notes |
|---|---|---|
| `GEMINI_API_KEY` | — | **Required.** |
| `SERVICE_ACCOUNT_PATH` | `./serviceAccountKey.json` | Or use Application Default Credentials (GCE metadata) by pointing this at a missing file. |
| `FIRESTORE_DATABASE_ID` | `xponet` | The app's named database. |
| `AGENT_MODEL` | `gemini-3.5-flash` | Or `gemini-flash-lite-latest`. `gemini-2.5-*` is retired for new projects. |
| `PORT` | `8787` | Must match the Vite/nginx proxy target. |
| `ALLOWED_ORIGIN` | reflect request | Only matters for direct cross-origin calls; behind a proxy it's same-origin. |

## Notes

- **Auth model:** the browser sends `Authorization: Bearer <Firebase ID token>`;
  the server verifies it with `admin.auth().verifyIdToken()`. The Admin SDK
  bypasses Firestore rules, so `loadMembership()` is the only authorization —
  it rejects any `orgId` the caller isn't a member of. Any new tool inherits
  that responsibility.
- **Shared logic:** `agent-core.js` holds the tool definitions + handlers. The
  Blaze-plan Cloud Function alternative (`../functions/agent.js`) duplicates
  this deliberately; if you change tool behavior, update both, or delete
  `functions/` since you're on the VM path.
- **GCE credentials shortcut:** if the VM's service account already has
  Firestore access, you can skip the JSON key file — leave
  `serviceAccountKey.json` absent and the server falls back to Application
  Default Credentials from the instance metadata.
