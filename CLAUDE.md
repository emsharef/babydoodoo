# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
```

No test framework is configured.

## Architecture Overview

This is a **Next.js 16 App Router** application for baby event tracking. It uses **Supabase** for authentication (magic link/OTP) and PostgreSQL database with Row Level Security (RLS).

### Directory Structure

- `/app` - Next.js App Router pages and API routes
- `/components` - React components (mix of server and client components)
- `/lib` - Utilities, hooks, Supabase clients, translations
- `/lib/server` - Server-only auth helpers
- `/supabase/migrations` - Database migrations

### Key Patterns

**Authentication Flow:**
- Client uses Supabase implicit auth flow with `persistSession: true`
- API routes extract Bearer token from `Authorization` header
- Server creates RLS-enabled Supabase client per request using `/lib/supabaseServer.js`
- No session storage; stateless token validation on each request

**State Management:**
- `BabyContext` - User, babies list, selected baby, role, pending invites
- `LanguageContext` - i18n with `t(key)` function (English + Chinese)
- No external state library; React Context + useState

**API Route Pattern:**
All routes in `/app/api/` follow: Zod validation → Bearer token extraction → Rate limiting → RLS client execution → JSON response

**Role-Based Access:**
- Owner (created baby), Parent, Caregiver, Viewer
- Roles stored in `memberships` table
- RLS policies enforce access at database level
- Viewers are read-only (enforced in UI and API)

### Database Schema (Key Tables)

- `babies` - id, user_id (owner), name, button_config (jsonb)
- `events` - id, baby_id, user_id, event_type, occurred_at, meta (jsonb)
- `memberships` - baby_id, user_id, role, email
- `invites` - baby_id, email, role, status, invited_by

### Event Types

21 event types across categories: Diapering (DooDoo, PeePee, Diaper), Feeding (YumYum), Sleep (SleepStart, SleepEnd), Health (Puke, Sick, Temperature, Medicine, Doctor), Mood (BabyMood, MyMood), Pregnancy (KickMe, Contraction, Heartbeat), Development (Play, Milestone, Measure), Misc (Note, CryCry, BlahBlah).

Event-specific metadata stored in `meta` jsonb field with nested structures like `meta.doo`, `meta.yum`, `meta.measure`.

### Important Files

- `/lib/supabaseClient.js` - Client-side Supabase (browser)
- `/lib/supabaseServer.js` - Server-side RLS client from Bearer token
- `/lib/server/auth.js` - Token extraction and validation
- `/lib/i18n.js` - Translation strings (en/zh)
- `/lib/events.js` - Event type definitions and categories
- `/components/BabyContext.jsx` - Central state provider

### Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
