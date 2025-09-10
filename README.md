# BabyDooDoo — Minimal Smoke Test (Step 1: RLS + Infra)

This tiny starter verifies **Supabase** wiring end-to-end and now includes **Row Level Security (RLS)** policies:
- **Magic link** sign-in (Implicit flow)
- Create a **baby**
- Log a single preset event: **DooDoo**
- **Delete** an event (exercises RLS deletes)
- `/api/health` endpoint for basic env diagnostics

> ⚠️ For this minimal app, we still write from the client with the anon key, but **RLS is enabled** and policies restrict access to the signed-in user. In the next step, we’ll move writes to server actions.

---

## 1) Requirements

- **Node.js 22+**
- A **Supabase** project

## 2) Supabase setup

1. **Authentication → Providers → Email**: Enable **Email**.
2. **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** `http://localhost:3000/auth/callback`
3. **SQL Editor**:
   - Run: [`/supabase/schema.sql`](./supabase/schema.sql)
   - Then run: [`/supabase/migrations/0002_enable_rls_and_policies.sql`](./supabase/migrations/0002_enable_rls_and_policies.sql)
     - This enables **RLS** and adds restrictive **policies**.
4. **API Keys**: From **Project Settings → API**, copy **Project URL** and **anon public key**.
5. Copy `.env.example` → `.env.local` and fill in values.

## 3) Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## 4) Flow to test

- Enter email → **Send magic link** (Implicit flow).
- Click the link in your email client → loads `/auth/callback` → redirects to `/` signed in.
- **Create a baby**, select it.
- Click **Log “DooDoo”** 💩.
- See the event in “Recent events” and try **Delete** (verifies RLS deletes).

## 5) Health check

- Visit `http://localhost:3000/api/health` to confirm required env vars are present.

---

## Notes

- **Implicit flow** avoids the PKCE “code_verifier” issue when opening the magic link in a fresh tab/app.
- RLS + policies now ensure a user only sees/edits **their** rows.
- Next step: move **writes** to **server actions** with a server-side service role and keep the UX identical.


---

## Step 2 Upgrade: Server‑backed writes (Route Handlers)

We moved **writes** off the browser and into **Next.js Route Handlers**, using a **server Supabase client** built with `@supabase/ssr`. This keeps your database mutations on the server (still under **RLS** with the user’s session), gives us a single place to validate inputs, and sets the stage for future features.

### What changed
- New server helper: `lib/supabaseServer.js` using `createServerClient` (cookies‑aware).
- New API routes:
  - `POST /api/babies` — create baby (requires auth, validates name)
  - `POST /api/events` — create **DooDoo** event (requires auth, validates payload)
  - `DELETE /api/events/:id` — delete an event (requires auth, RLS‑checked)
- UI now calls these API routes (`fetch`) instead of writing directly with the browser Supabase client.
- **RLS** remains enabled (from Step 1). Policies still gate access by `auth.uid()`.

### Install new deps
```
npm install @supabase/ssr zod
```

### Why this step
- Centralizes writes for consistency and logging later.
- Keeps auth ergonomics (implicit flow) unchanged for now.
- Prepares for future steps:
  - Server Action forms (optional)
  - Service‑role writes + revoking client DML (if we choose to lock down the REST surface)
  - Membership & sharing logic on the server
  - Realtime

### Notes
- We still fetch lists directly from Supabase in the browser for simplicity. That’s fine under RLS. We can migrate reads to the server later if needed.
- No new environment variables required for this step.

### Having 500 errors mentioning `supabaseAdmin` or `SUPABASE_SERVICE_ROLE_KEY`?
This starter does **not** use a service-role client. If you see stack traces like:

```
[supabaseAdmin] Missing env vars ... SUPABASE_SERVICE_ROLE_KEY
```
it means an old file like `lib/supabaseAdmin.js` or old imports are still present in your local project.

**Fix:**
1. Remove any `lib/supabaseAdmin.js` (it is not used in this starter).
2. Search your repo for `supabaseAdmin` and delete/update those imports. All server routes should import from:
   ```js
   import { createServerSupabaseClientFromToken } from '@/lib/server/supabaseServerClient';
   ```
3. Clean Next cache and restart:
   ```bash
   rm -rf .next
   npm run dev
   ```

Optional helper: run `scripts/doctor.sh` to detect stray imports.


### Important: use a clean folder
If you previously overlaid files into an existing project, you may have leftover files like `lib/supabaseServer.js` that expect a `SUPABASE_SERVICE_ROLE_KEY`. This starter **does not** use a service key. To avoid collisions:
- Unzip into a **new empty directory**, or
- Delete any old server files that reference `SUPABASE_SERVICE_ROLE_KEY`.
- We use **relative imports** (`../lib/server/auth`) so the intended helpers are always used.

---

## Step 2.2 Upgrade: Rate limiting + Structured logging

**Why:** protect write endpoints against accidental/abusive bursts and get basic observability.

### What’s new
- In-memory **fixed-window** rate limiter (per-user+route, fallback per-IP)
- Structured **console logging** per request with request id, status, duration, and IP hash
- Response headers on 429: `Retry-After`, `X-RateLimit-*`, `X-Request-Id`

### Config (env, optional)
- `RATE_WINDOW_MS` (default `60000`)
- `RATE_MAX_WRITES_PER_USER` (default `60`)

### Routes instrumented
- `POST /api/babies`
- `POST /api/events`
- `DELETE /api/events/:id`

> In serverless environments, in-memory rate limits reset between invocations. This is perfectly fine for local dev and MVP staging. We’ll upgrade to a durable store (Redis/Upstash or Postgres) later if needed.

### About 0003_revoke_client_writes.sql
**Do not run it yet.** Our current server routes perform writes with the **user’s token** (role `authenticated`), enforced by **RLS**. If you revoke client writes now, those routes will also fail. We’ll switch to a service-role or RPC pattern and then explicitly ask you to run it.
