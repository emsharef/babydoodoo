# BabyDooDoo Minimal (fix3)

## Setup
1) Create a Supabase project; enable Email magic links.
2) Copy `.env.example` -> `.env.local` and fill values.
3) If starting from an empty DB, run `supabase/schema.sql` first.
4) Apply migrations (in order). If you already ran previous ones, just run the **new** one at the end.
   - `supabase/migrations/0004d_1_create_invites_if_missing.sql`
   - `supabase/migrations/0004d_2_policies_cast_text.sql`
   - `supabase/migrations/0004e_fix_memberships_select_no_recursion.sql`
   - `supabase/migrations/0004f_cleanup_duplicate_policies.sql`
   - `supabase/migrations/0004g_events_insert_member_or_owner.sql`
   - `supabase/migrations/0004h_case_insensitive_email_in_policies.sql`
   - `supabase/migrations/0004i_invites_update_split_accept_vs_revoke.sql`
   - `supabase/migrations/0004j_rpc_accept_invite_tx.sql`   <-- NEW (transactional accept)

5) Dev:
```bash
npm install
npm run dev
```

## What’s new in fix3
- Accepting an invite now uses a **SECURITY DEFINER RPC** (`accept_invite_tx`) that atomically:
  1) Verifies invite is **pending** and belongs to the caller’s email.
  2) **Upserts membership** for the caller.
  3) Marks invite **accepted**.
  → This removes any chance of RLS-policy race or partial updates.
- After accept, the UI auto-selects that baby and loads events.
- Baby selection logic prefers the **current selection** if still visible; otherwise picks the first.
