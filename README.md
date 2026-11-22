# VARSITY — College PE Department Management Platform

VARSITY is a secure, purpose-built management platform for a college Physical
Education department. Phase 1 establishes the foundation: student accounts, an
official student directory, configurable departments, PE roster membership,
role-based access and two distinct dashboards. Phase 2 adds the daily PE
operations: attendance, class tasks, the digital visitor register, room
entry/exit with live occupancy, QR posters and R2-backed file storage.

The design direction is **VARSITY — Athletic Digital Experience**: collegiate
athletics typography, a navy/chalk/lime palette and scoreboard-inspired data —
with real records only.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui-style primitives, Lucide React |
| Forms | React Hook Form, Zod, `@hookform/resolvers` |
| Backend | Supabase PostgreSQL, Supabase Auth, Row Level Security |
| Auth integration | `@supabase/ssr` (cookies + proxy session refresh) |
| Hosting | Vercel-compatible |
| Testing | Vitest (pure logic), TypeScript, ESLint, production build |

Reserved for later phases (not used in Phase 1): Cloudflare R2, Resend,
Cloudflare Turnstile.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template if needed (an `.env.example` with placeholders
   is included). Fill in the values in your local `.env` — never commit it.

   Required in Phase 1:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (server-only)

   Optional/reserved: `NEXT_PUBLIC_SITE_URL`, `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`,
   `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
   `TURNSTILE_SECRET_KEY`.

   See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md). Do not put the secret key in a
   `NEXT_PUBLIC_` variable or in browser code.

3. Apply the database migration: see [docs/DATABASE.md](docs/DATABASE.md).

4. Create the first PE administrator: see
   [docs/ADMIN_BOOTSTRAP.md](docs/ADMIN_BOOTSTRAP.md).

5. Start the app:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>.

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # serve production build
npm run typecheck  # TypeScript check
npm run lint       # ESLint
npm test           # Vitest unit tests
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/register` | Student registration |
| `/login`, `/forgot-password`, `/reset-password` | Authentication flows |
| `/auth/callback` | OAuth/email confirmation and recovery callback |
| `/dashboard` | Student dashboard |
| `/profile` | Student profile and display-name settings |
| `/admin/dashboard` | Live department metrics and recent registrations |
| `/admin/students` | Accounts, official directory, import and manual records |
| `/admin/pe-roster` | Active PE membership management |
| `/admin/departments` | Department configuration |
| `/unauthorized` | Permission denied page |

## Phase 1 features

- Public landing page with clear student/staff entry points.
- Registration with strong validation, duplicate USN detection, secure linking
  to official directory records, pending verification for unmatched records,
  and email-confirmation support.
- Email/password sign-in, logout, password recovery and reset, session refresh
  through Next's proxy convention with `@supabase/ssr`.
- Server-enforced role checks on every protected route, backed by RLS — hidden
  buttons are not the security boundary.
- Configurable departments with activation, search and student counts.
- Official student directory with CSV import (template, preview, validation,
  row-level error reporting, import history) and manual record creation/correction.
- Separate PE roster: add, remove and reactivate membership with history and
  audit logging. Adding a student does not create an account; removing one does
  not delete their account.
- Real-data student and admin dashboards with empty states.

## Architecture

```text
src/
  app/                 routes, layouts, server actions, auth callback
  components/
    ui/                shadcn-style primitives
    layout/            public/student/admin shells
    forms/             validated forms
    tables/            admin management tables
    shared/            badges, empty states
  lib/
    auth/              server-side session and role checks
    data/              grouped Supabase queries for dashboards/pages
    env/               server/public environment access
    permissions/       role constants and helpers
    supabase/          browser, server, privileged and proxy clients
    utils/             normalisation, formatting, import parsing
    validations/       centralised Zod schemas
  types/               database and view-model types
supabase/migrations/   phase 1 SQL migration
docs/                  setup, database, admin and phase documentation
tests/                 unit tests for pure logic
```

Privileged database operations (registration and role assignment) use
`SUPABASE_SECRET_KEY` only from server code. All ordinary reads and writes use
the publishable key with RLS enforced.

## Planned in later phases (not implemented here)

Digital classroom and attendance, assignments, visitor register, room QR,
games and challenges, events and tournaments, team payments, brackets,
announcements, rules library, equipment registers, QR printing, reports and
exports, activity calendar, feedback, student sports profiles, PWA installation.
Navigation and database design leave room for these modules, but no placeholder
or fake working buttons have been added.

## Deployment

Vercel-compatible. Configure the environment variables in the project settings,
apply the Supabase migration, then deploy with the default `npm run build`
command. Set `NEXT_PUBLIC_SITE_URL` to the deployed origin so email confirmation
and password reset links return to the correct host.
