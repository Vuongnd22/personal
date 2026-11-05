# ArchBoard

Product architecture & task management for an R&D team: a Draw.io-style architecture canvas per product,
plus features → tasks with automatic progress and overdue detection.

- Brief: `docs/requirements.md` · Design spec (authoritative): `docs/spec.md`
- Stack: NestJS + Prisma + PostgreSQL (`backend/`), Next.js App Router + Tailwind + Radix + React Flow + Recharts + TanStack Query (`frontend/`)

## Quick start (no Docker needed)

```bash
npm install
npm run dev
```

`npm run dev` starts an embedded PostgreSQL on :5433 (data in `.pgdata/`), applies migrations, seeds demo data
if the database is empty, then runs the API on :4000 and the web app on :3000. Ctrl+C stops everything.

Open **http://localhost:3000**.

| Account | Password | Role |
|---|---|---|
| admin@archboard.local | Admin@123 | Admin (everything incl. users) |
| manager@archboard.local | Manager@123 | Manager (products, features, tasks, diagrams) |
| lan@, huy@, thao@, duc@archboard.local | Member@123 | Member (read all, own/assigned tasks) |

To use your own Postgres instead, set `DATABASE_URL` (see `.env.example`) — or `docker compose -f docker-compose.dev.yml up`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Full dev stack (embedded Postgres + API + web) |
| `npm run db:reset` | Drop, migrate and re-seed the dev database |
| `npm run build` | Build backend and frontend |
| `npm test` | Backend + frontend unit tests |
| `npm run test:int --workspace backend` | API integration tests on a throwaway embedded Postgres |
| `npm run lint --workspace frontend` | ESLint |

## Domain rules worth knowing

- **Overdue is derived, never stored**: open task with `deadline < today` (in `APP_TIMEZONE`). Moving the deadline changes it immediately.
- **Completed late** is frozen when a task is completed; later deadline edits don't rewrite it.
- **Progress** = completed / total tasks (product progress is task-weighted across all its features). Computed from the DB on each request, so every screen agrees.
- Diagram saves are whole-diagram replacements with optimistic concurrency (409 if someone saved meanwhile).

## Layout

```
backend/   NestJS API under /api — src/common/domain.ts holds the pure rules (unit-tested)
frontend/  Next.js app — calls the API same-origin via the /api rewrite (cookie auth, no CORS)
scripts/   dev.mjs (one-command stack), pg.mjs (embedded Postgres helper)
docs/      requirements, spec
```

## Production (Docker)

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
docker compose up --build
```

Runs Postgres 17, the API (runs `prisma migrate deploy` on start) and the web app on :3000, with named volumes
for the database and uploaded attachments. Seed data is not loaded in production; create users from an admin
account (seed once with `npm run db:seed --workspace backend` against the production `DATABASE_URL` if you
want the demo data). The Docker files were written without being run on the dev machine (no Docker there).
