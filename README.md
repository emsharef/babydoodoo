# BabyDooDoo

A baby event tracking app built with Next.js 16 and Supabase. Track diaper changes, feedings, sleep, health, milestones, and more. Designed for quick one-tap logging with support for multiple caregivers.

## Features

- **Quick event logging** — Tap to record an event instantly. A bottom sheet slides up for optional details; auto-saves if untouched.
- **21 event types** — Diapering, feeding, sleep, health, mood, milestones, pregnancy tracking, and more.
- **Multi-caregiver support** — Share access with family members via invite links. Role-based permissions (Owner, Parent, Caregiver, Viewer).
- **PWA support** — Install on iOS/Android home screen for native app experience.
- **Multi-language** — English and Chinese translations.
- **Photo import** — Import events from photos of handwritten logs using Gemini Vision API.
- **Analytics** — Visualize patterns with charts (feeding, sleep, diaper trends).
- **Data tools** — Export/import data with timezone support.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Main logging interface — tap buttons to record events |
| `/analytics` | Charts and statistics for tracked events |
| `/share` | Manage family members, send invites, accept pending invites |
| `/settings` | Account settings, create baby profiles, customize buttons, sign out |
| `/tools` | Data export/import, photo import with AI |

## Getting Started

1. Copy `.env.example` to `.env.local` and configure:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   GEMINI_API_KEY=your_gemini_key  # Optional, for photo import
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Auth:** Supabase OTP (email code verification)
- **Charts:** ECharts
- **Icons:** Tabler Icons
- **PWA:** @ducanh2912/next-pwa

## Event Types

| Category | Events |
|----------|--------|
| Diapering | DooDoo, PeePee, Diaper |
| Feeding | YumYum (bottle, breast, solids) |
| Sleep | SleepStart, SleepEnd |
| Health | Puke, Sick, Temperature, Medicine, Doctor |
| Mood | BabyMood, MyMood |
| Development | Play, Milestone, Measure |
| Pregnancy | KickMe, Contraction, Heartbeat |
| Misc | Note, CryCry, BlahBlah |

## Database Schema

Key tables with Row Level Security:

- `babies` — Baby profiles with customizable button config
- `events` — All tracked events with metadata in JSONB
- `memberships` — User roles per baby (owner, parent, caregiver, viewer)
- `invites` — Pending invitations

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
```
