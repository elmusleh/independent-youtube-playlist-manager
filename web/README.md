# Web Portal (`web/`)

Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui marketing site for Independent YouTube Playlist Manager.

## Commands (from repository root)

```bash
npm run web          # Dev server → http://localhost:3000
npm run web:build    # Production build
npm run web:test     # Playwright end-to-end tests
```

## Structure

- `src/app/` — App Router pages, layout, API routes (`/api/sync`, `/api/tokens`, `/api/convert/spotify`)
- `src/components/landing/` — Marketing landing page sections (Navbar, Footer, etc.)
- `src/components/ui/` — shadcn/ui primitives
- `supabase/schema.sql` — PostgreSQL schema with Row-Level Security

## Environment

Optional Supabase integration reads from `web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Without these, the site runs in graceful offline/demo mode.

See the [root README](../README.md) and [AGENTS.md](../AGENTS.md) for the full project architecture.
