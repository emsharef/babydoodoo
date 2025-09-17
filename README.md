# BabyDooDoo — UI split

This build reorganizes the UI into three pages with **no database changes**:

- **/** — *Log events* (baby selector + DooDoo + recent events)
- **/share** — Sharing & invites (members list, invite/revoke, accept pending)
- **/settings** — Account (logout) + create baby

## Run
1. Copy `.env.example` → `.env.local` and fill Supabase values.
2. `npm install`
3. `npm run dev`

> DB must already be migrated to the working state from the previous steps.
