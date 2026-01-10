# CLAUDE.md - AI Assistant Guide for BabyDooDoo

## Project Overview

BabyDooDoo is a baby and pregnancy event tracking application built with Next.js 16 and React 19. It allows parents and caregivers to log various events (diaper changes, feedings, sleep, moods, health metrics, pregnancy tracking, etc.) and view analytics over time.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **React**: 19.2.x
- **Database/Auth**: Supabase (PostgreSQL + Auth)
- **Charts**: ECharts 5.5
- **Icons**: Tabler Icons React
- **Validation**: Zod
- **Styling**: Inline styles + styled-jsx (no CSS modules or Tailwind)

## Directory Structure

```
babydoodoo/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API route handlers
│   │   ├── babies/        # Baby CRUD
│   │   ├── events/        # Event CRUD (main functionality)
│   │   ├── invites/       # Invite management (accept, revoke, mine)
│   │   ├── memberships/   # Family member management
│   │   ├── share-links/   # Shareable invite links
│   │   ├── health/        # Health check endpoint
│   │   └── whoami/        # Current user info
│   ├── analytics/         # Analytics dashboard page
│   ├── auth/callback/     # OAuth/magic link callback
│   ├── debug/             # Debug utilities page
│   ├── settings/          # User settings page
│   ├── share/             # Family sharing page
│   ├── tools/             # Kick counter, contraction timer
│   ├── layout.jsx         # Root layout with providers
│   └── page.jsx           # Main log page (home)
├── components/            # React components
│   ├── analytics/         # Analytics-specific components
│   │   ├── charts/        # ECharts wrappers
│   │   ├── Categories.jsx # Category-specific analytics
│   │   ├── CategoryTabs.jsx
│   │   ├── ChartCard.jsx
│   │   ├── EmptyState.jsx
│   │   └── KpiCard.jsx
│   ├── BabyContext.jsx    # Global baby/user state context
│   ├── BottomSheet.jsx    # Slide-up detail editor
│   ├── ClientProviders.jsx # Client-side provider wrapper
│   ├── IconButton.jsx     # Event logging buttons
│   ├── InviteBanner.jsx   # Pending invite notification
│   ├── LanguageContext.jsx # i18n context provider
│   ├── NavBar.jsx         # Navigation bar
│   └── Toast.jsx          # Toast notifications
├── lib/                   # Utilities and helpers
│   ├── hooks/             # Custom React hooks
│   │   └── useAnalyticsData.js
│   ├── server/            # Server-only utilities
│   │   ├── auth.js        # Bearer token authentication
│   │   └── supabaseServerClient.js
│   ├── events.js          # Event type definitions
│   ├── http.js            # HTTP utilities
│   ├── i18n.js            # Translation strings (en, zh)
│   ├── log.js             # Request logging
│   ├── rateLimit.js       # Rate limiting
│   ├── supabaseAdmin.js   # Admin client (avoid using)
│   ├── supabaseClient.js  # Browser client
│   └── supabaseServer.js  # Server-side RLS client
├── scripts/               # Development scripts
│   ├── apply_migration.js # Apply SQL migrations
│   └── doctor.sh          # Health check script
├── supabase/migrations/   # Database migrations
├── jsconfig.json          # Path aliases (@/*)
├── next.config.mjs        # Next.js configuration
└── package.json           # Dependencies
```

## Key Conventions

### File Naming
- Pages: `page.jsx` (Next.js App Router convention)
- API Routes: `route.js` (standard Next.js)
- Components: `PascalCase.jsx`
- Utilities: `camelCase.js`

### Import Aliases
Use `@/` alias for imports from project root:
```javascript
import { useBaby } from '@/components/BabyContext';
import { supabase } from '@/lib/supabaseClient';
```

### Styling
- **Inline styles** are the primary styling method
- **styled-jsx** for scoped CSS when needed (via `<style jsx>` blocks)
- No CSS modules, Tailwind, or external CSS files
- Color scheme: Soft pastels with white backgrounds

### Component Patterns

**Client Components**: Start with `'use client';` directive
```javascript
'use client';
import { useState } from 'react';
// ...
```

**Context Usage**: Use provided contexts for global state
```javascript
const { user, babies, selectedBabyId, role, refreshBabies } = useBaby();
const { t } = useLanguage();
```

**Roles**: `owner`, `parent`, `caregiver`, `viewer`
- Viewers have read-only access
- Only parents/owners can delete babies or edit button config

### API Route Patterns

All API routes follow this structure:
```javascript
import { z } from 'zod';
import { createRlsClient, requireUserFromBearer } from '@/lib/supabaseServer';
import { limit, keyFor } from '@/lib/rateLimit';
import { getIp, logRequest, newRequestId } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({ /* ... */ });

export async function POST(request) {
  const __start = Date.now();
  const __id = newRequestId();
  const __ip = getIp(request);

  // Parse and validate body
  const parsedBody = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(parsedBody);
  if (!parsed.success) {
    // Return 400 with validation errors
  }

  // Authenticate user
  const auth = await requireUserFromBearer(request);
  if (auth.error) {
    // Return auth error
  }

  // Create RLS client with user's token
  const { token, user } = auth;
  const supabase = createRlsClient(token);

  // Rate limiting
  const __key = keyFor({ route: '/api/...', method: 'POST', userId: user.id, ip: __ip });
  const __rl = limit({ key: __key, windowMs: 60000, max: 60 });
  if (!__rl.ok) {
    // Return 429
  }

  // Business logic with Supabase
  const { data, error } = await supabase.from('...').insert([...]);

  // Log and return response
  logRequest({ id: __id, route: '...', method: 'POST', status: 201, ms: Date.now() - __start, userId: user.id, ip: __ip });
  return new Response(JSON.stringify({ ... }), { status: 201, headers: { 'content-type': 'application/json' } });
}
```

### Authentication

- Uses Supabase Auth with magic links (email OTP)
- Bearer tokens passed in `Authorization: Bearer <token>` header
- Server-side: Use `requireUserFromBearer()` and `createRlsClient(token)`
- Client-side: Use `supabase.auth.getSession()` to get token

**Important**: Never use `supabaseAdmin` - always use RLS clients with user tokens.

### Database (Supabase)

**Tables**:
- `babies` - Baby profiles with `button_config` JSON
- `events` - Logged events with `event_type`, `occurred_at`, `meta` JSON
- `memberships` - User-baby relationships with roles
- `invites` - Pending family invites

**Row Level Security (RLS)**: All tables have RLS enabled. Queries automatically filter based on the authenticated user's token.

### Event Types

Defined in `lib/events.js`:
```
DooDoo, PeePee, Diaper, YumYum, SleepStart, SleepEnd,
Puke, Sick, Temperature, Medicine, Doctor,
BabyMood, MyMood, Play, Milestone, Note,
KickMe, Contraction, Heartbeat,
CryCry, BlahBlah, Measure
```

Each event can have metadata in `meta` JSON field (e.g., `meta.doo.consistency`, `meta.yum.quantity`).

### Internationalization

- Translations in `lib/i18n.js`
- Supported languages: English (`en`), Chinese (`zh`)
- Use `t('key.path')` function from `useLanguage()` context
- Translation keys follow pattern: `section.key` (e.g., `log.welcome`, `event.doodoo`)

## Development Workflow

### Setup
```bash
# 1. Copy environment template
cp .env.example .env.local

# 2. Fill in Supabase values:
# NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# 3. Install dependencies
npm install

# 4. Start development server
npm run dev
```

### Available Scripts
```bash
npm run dev    # Start development server
npm run build  # Production build
npm run start  # Start production server
```

### Health Check
```bash
# Run doctor script to check for issues
./scripts/doctor.sh

# Or visit health endpoint
curl http://localhost:3000/api/health
```

### Database Migrations
Migrations are in `supabase/migrations/`. Apply using:
```bash
node scripts/apply_migration.js <migration_file.sql>
```

## Common Tasks

### Adding a New Event Type
1. Add to `AllowedEvents` enum in `app/api/events/route.js`
2. Add definition to `EVENT_DEFS` in `lib/events.js`
3. Add translations in `lib/i18n.js` for both `en` and `zh`
4. Add editor UI in `app/page.jsx` (inside BottomSheet)
5. Add display logic in `MetaInline` component
6. Add analytics category handling if needed

### Adding a New API Endpoint
1. Create route file: `app/api/<name>/route.js`
2. Follow the standard pattern (validation, auth, rate limiting, logging)
3. Use Zod for request validation
4. Use `createRlsClient(token)` for database access

### Adding Translations
1. Edit `lib/i18n.js`
2. Add key to both `en` and `zh` objects
3. Use via `t('your.key')` in components

## Security Notes

- All API routes require Bearer token authentication
- Rate limiting is applied per-user and per-IP
- RLS policies enforce data access at the database level
- Never expose `supabaseAdmin` or service role keys
- Validate all inputs with Zod schemas

## Testing

No automated tests currently. Manual testing:
1. Run `./scripts/doctor.sh` for basic checks
2. Test all event types via UI
3. Test sharing/invite flow with multiple accounts
4. Test analytics with various date ranges

## Troubleshooting

### Common Issues

**"Missing bearer token"**: User not authenticated or session expired
- Check `supabase.auth.getSession()` returns valid session
- Ensure token is passed in Authorization header

**RLS policy errors**: User doesn't have access to requested data
- Check memberships table for user-baby relationship
- Verify role permissions

**Rate limit exceeded**: Too many requests
- Default: 60 writes per user per minute
- Configurable via `RATE_WINDOW_MS` and `RATE_MAX_WRITES_PER_USER` env vars
