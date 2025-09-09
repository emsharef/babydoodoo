# BabyDooDoo — Minimal Smoke Test (Infra & Security Step)

This small starter verifies your **Supabase** setup end-to-end:
- **Magic link** login (Implicit flow; robust when opening from email apps)
- Create a **new baby**
- Log a single preset event: **DooDoo**
- **RLS & Policies** migration to isolate data per user
- Tiny **Delete** button to test RLS deletes
- **/api/health** endpoint for environment sanity

> ⚠️ For local testing only. The initial `schema.sql` disables RLS so you can bootstrap easily.
> Then run the RLS migration to enforce security.

---

## 1) Requirements

- **Node.js 22 LTS**
- A **Supabase** project

## 2) Supabase setup

1. In **Authentication → Providers → Email**, enable **Email**.
2. In **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** `http://localhost:3000/auth/callback`
3. In **SQL Editor**, run `supabase/schema.sql` (creates tables; RLS disabled).
4. Then run `supabase/migrations/0002_enable_rls_and_policies.sql` (enables RLS + policies and fixes grants).
5. In **Project Settings → API**, copy your **Project URL** and **anon public key**.
6. Copy `.env.example` → `.env.local` and fill values.

## 3) Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## 4) Test flow

- Enter your email → **magic link** arrives.
- Click the link (even from a mobile email app) → `/auth/callback` → signed in → redirected home.
- **Create a baby**.
- Click **Log “DooDoo”** → event appears in **Recent events**.
- Click **Delete** to confirm RLS delete works.

## 🔧 Fix for PKCE "code_verifier" errors

If a magic link opens in a different webview/tab, PKCE may fail due to missing `code_verifier` in localStorage.
This starter uses **Implicit flow** (`flowType: 'implicit'` + `detectSessionInUrl: true`), so the link works in a fresh tab/app.
The `/auth/callback` page simply waits for Supabase to set the session and then redirects to `/`.

---

## Step 1 Upgrade: Infrastructure & Security

This step enables **Row Level Security (RLS)** and adds **policies** so that each user can only see and modify their own data.
It also adds a tiny **Delete** button (to exercise RLS deletes) and a `/api/health` endpoint.

**If you already ran the older smoke test schema:**  
1) Run: `supabase/migrations/0002_enable_rls_and_policies.sql`

**If you are starting fresh:**  
1) Run: `supabase/schema.sql`  
2) Run: `supabase/migrations/0002_enable_rls_and_policies.sql`

### What the policies enforce

- You can only access **your** babies.
- You can only access **your** events, and only if the event’s `baby_id` belongs to you.
- Inserts/updates require `user_id = auth.uid()` and `baby_id` owned by you.

---

## Next steps

- Move writes to **server actions/route handlers** with a **service role key** (server-side).
- Keep reads client-side under RLS, or move sensitive reads server-side as needed.
- Introduce a simple **memberships** model for sharing (owner/editor/viewer) in a later step.
