# Cloud QC — setup

Real Next.js rebuild of the `cloud-qc (3).html` prototype.

Stack: Next.js 16 (App Router) · Prisma 6 · Supabase Postgres · Auth.js v5
(email/password + Google OAuth, JWT sessions).

## What works right now

- Prisma schema (`prisma/schema.prisma`) + seed (`prisma/seed.ts`), migrations applied
- Auth: signup (→ pending), login, Google OAuth restricted to `youngmuslims.com`, admin-approval gate
- Route protection via `src/proxy.ts`
- App shell (sidebar + mobile nav)
- **All feature screens are live against the database:**
  - Dashboard — stats, goal bar, network orbit, recent visits, grid/map toggle
  - Submit Feedback — survey with progress, ratings, co-visitors, duplicate
    detection (link vs separate), edit your own submissions
  - Neighbornets — list + detail (attendance chart, visit table, feedback-sent
    toggle), admin add form
  - Network Map — d3 state map with status pins, region fallback
  - Cloud Team — per-member visit stats, list + detail
  - Rotation — join/leave/assign pairings + history
  - Admin — approve/reject accounts, role toggle, dashboard adjustments

## First-time setup

### 1. Supabase

Create a project at supabase.com, then from **Project Settings → Database →
Connection string** copy two URLs into `.env`:

- `DATABASE_URL` — **Transaction** pooler, port `6543`. Append
  `?pgbouncer=true&connection_limit=1`.
- `DIRECT_URL` — **Session** pooler (or direct), port `5432`. Used for migrations.

### 2. Auth secret

```bash
npx auth secret        # writes AUTH_SECRET into .env
```

### 3. Google OAuth (optional but recommended)

Google Cloud Console → APIs & Services → Credentials → **OAuth client ID → Web
application**. Authorized redirect URI:

```
http://localhost:3000/api/auth/callback/google
```

Put the client ID / secret in `.env` as `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
Leave them blank to hide the Google button.

### 4. Migrate + seed

```bash
npm run db:migrate      # creates tables (prisma migrate dev)
npm run db:seed         # promotes SEED_ADMIN_EMAIL to ADMIN, loads 13 NJ neighbornets
```

Set `SEED_ADMIN_PASSWORD` in `.env` first if you want to log in without Google.

### 5. Run

```bash
npm run dev             # http://localhost:3000
```

## Scripts

| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` (production) |
| `npm run db:seed` | run `prisma/seed.ts` |
| `npm run db:studio` | Prisma Studio |

## Notes

- Enable **RLS** on all tables in Supabase with no public policies — the app
  only ever reaches the DB through server code, so RLS is defense-in-depth.
- After the first migration, a partial unique index still needs to be added
  (one active rotation assignment per neighbornet+member) — see the pending
  follow-up in the schema comments.
- `npm audit` flags `deepmerge-ts` via the Prisma CLI (dev-only tooling); no
  runtime impact.
