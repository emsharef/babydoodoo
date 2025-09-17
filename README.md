# BabyDooDoo — UI split + Logging UX

This build adds the logging UX we discussed:

- **Tap = record now** (immediate event insert).
- A tiny **bottom sheet** slides up. If untouched, it auto-hides after ~1s and the event is kept.
- If you start typing/selecting, the sheet becomes **sticky** (stays open) until you **Save**.
- **Undo** toast appears after every save (“Saved DooDoo · Undo”). Clicking Undo deletes the just-created event.
- **DooDoo details:** consistency, color, notes — saved into `events.meta.doo` via a `PATCH /api/events/:id` call.
- **Baby selector moved to the top bar (right)** across pages via a small context.

## Pages
- **/** — Log events (clean surface, bottom sheet & undo)
- **/share** — Members, invite/revoke, accept pending
- **/settings** — Account + Create baby + Sign out

## Run
1. Copy `.env.example` → `.env.local` and fill Supabase values.
2. `npm install`
3. `npm run dev`

> No database changes are required. RLS policies already allow creators to update their own events, which the new `PATCH` endpoint uses.
