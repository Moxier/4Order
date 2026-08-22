# 4Order

Mobile-first QR restaurant ordering for a small restaurant in Thailand. The
repository is currently at **Phase 2: Customer QR ordering**. Customers can
submit free-form Thai orders from an opaque table-token URL; kitchen and
cashier operations remain intentionally deferred.

See [the architecture](docs/ARCHITECTURE.md),
[the Phase 2 plan](docs/PHASE_2_PLAN.md), and the product requirements in
[SPEC.md](SPEC.md).

## Stack

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS
- Supabase PostgreSQL, Auth, and future Realtime delivery
- Zod validation
- Vitest, ESLint, and TypeScript verification
- pnpm package management

The application framework supports Node.js 20.9+, but this repository uses
pnpm 11 tooling and therefore requires Node.js 22 or newer.

## Local development

### Prerequisites

- Node.js 22+
- pnpm 11+
- Docker Desktop or another Docker-compatible runtime supported by the
  Supabase CLI

### First setup

1. Install JavaScript dependencies:

   ```bash
   pnpm install
   ```

2. Start local Supabase:

   ```bash
   pnpm db:start
   ```

3. Reset the local database. This applies every migration and loads the five
   Thai demo tables from `supabase/seed.sql`:

   ```bash
   pnpm db:reset
   ```

4. Copy `.env.example` to `.env.local`. Run `pnpm supabase status` and copy the
   local API URL, publishable/anonymous key, and service-role key into the
   matching variables. Set a development-only password of at least 12
   characters in `DEMO_STAFF_PASSWORD`. Keep `TRUST_PROXY_HEADERS=false` for
   direct local development and list every exact local application origin in
   `TRUSTED_APP_ORIGINS`.

5. Provision the local demo staff accounts:

   ```bash
   pnpm seed:staff
   ```

   The command is idempotent and refuses to run against a remote Supabase URL
   unless `ALLOW_REMOTE_DEMO_SEED=true` is deliberately supplied. It never
   prints the password.

6. Start Next.js:

   ```bash
   pnpm dev
   ```

   Open `http://localhost:3000`.

### Try customer ordering

After `pnpm db:reset`, open Supabase Studio at `http://localhost:54323` and
read one demo row from `restaurant_tables`. Use its opaque `public_token` in:

```text
http://localhost:3000/order/{public_token}
```

The customer enters one free-form item per line, reviews the exact text, and
submits it. Retrying the same network request returns the original order number
instead of creating another order. No catalog selection is used in V1.

### Demo staff accounts

All three use the local password stored only in `DEMO_STAFF_PASSWORD`:

| Email | Role | Initial route |
| --- | --- | --- |
| `kitchen@4order.local` | KITCHEN | `/kitchen` |
| `cashier@4order.local` | CASHIER | `/cashier` |
| `admin@4order.local` | ADMIN | `/admin` |

Do not use these accounts or their password in production.

## Database workflow

Migration files under `supabase/migrations` are the schema source of truth.
Do not make production schema changes directly in Supabase Studio.

```bash
# Create a migration
pnpm supabase migration new descriptive_name

# Rebuild local data from migrations and seed data
pnpm db:reset

# Run database lint checks against local Supabase
pnpm db:lint

# Refresh generated public-schema TypeScript types
pnpm db:types
```

`db:types` replaces `src/shared/supabase/database.generated.ts`; commit the
generated result when application queries begin relying on it.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run database verification separately while local Supabase is active:

```bash
pnpm db:reset
pnpm db:lint
pnpm db:test
pnpm db:test:concurrency
```

Run the real HTTP and browser retry suite against a production build while
local Supabase is active:

```bash
pnpm exec playwright install chromium
pnpm build
pnpm test:e2e
```

## Production deployment

1. Create separate Supabase projects for staging and production in a region
   appropriate for the restaurant. Enable backups suitable for real operations.
2. Keep public email sign-up disabled. Create the first production Auth user
   securely, then insert its `staff_profiles` row with role `ADMIN`. Do not run
   the demo staff seeder against production.
3. Authenticate the Supabase CLI, link the intended project, review the target,
   and apply committed migrations:

   ```bash
   pnpm supabase login
   pnpm supabase link --project-ref YOUR_PROJECT_REF
   pnpm supabase db push
   ```

   `supabase/seed.sql` contains demo tables; only include it remotely when those
   names are genuinely desired. Staff identities are never in SQL seed data.

4. Deploy the Next.js application to a Node.js 20.9+ host. Set these environment
   variables in the host, using production values:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; required by customer ordering)
   - `TRUSTED_APP_ORIGINS` (comma-separated exact HTTPS application origins)
   - `TRUST_PROXY_HEADERS` (normally `false`; enable only behind an ingress
     that overwrites forwarded host/protocol headers)

5. Configure the production Supabase Auth site URL and allowed redirect URLs to
   the exact HTTPS application origin.
6. Run lint, type checking, tests, build, database lint, role-access smoke tests,
   and backup/restore checks before using the system in the restaurant.

The initial production administrator can be associated after its Auth user is
created by inserting data (not schema) in a controlled SQL session:

```sql
insert into public.staff_profiles (user_id, display_name, role)
values ('AUTH-USER-UUID', 'ชื่อผู้ดูแล', 'ADMIN');
```

## Security notes

- Customer QR URLs use `restaurant_tables.public_token`, never table UUIDs.
- Customer mutations are handled by a same-origin server route and a narrowly
  granted transaction function; browsers never receive the service-role key.
- Staff pages already enforce roles in server code and PostgreSQL RLS.
- `SUPABASE_SERVICE_ROLE_KEY`, `.env.local`, and real passwords must never be
  committed or exposed through `NEXT_PUBLIC_` variables.
- Customer order text is untrusted, size-limited in the database, and immutable.
- Customer request bodies are limited by UTF-8 bytes actually read, not only by
  the caller-provided `Content-Length` header.
- Same-origin checks compare the complete origin against an explicit allowlist.
  Forwarded headers are ignored unless a trusted-proxy deployment policy is
  deliberately enabled.
- Money is stored as integer satang.

## Current scope

Implemented now: the Phase 1 foundation plus public QR token resolution,
free-form Thai order confirmation/submission, local draft retention,
idempotent retries, transaction-safe active sessions, and additional orders.

Not implemented yet: realtime kitchen orders, cashier payment UI, customer
service requests/feedback, admin tools, printing, and PWA behavior. These remain
assigned to later phases in `SPEC.md`.
