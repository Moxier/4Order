# Phase 1 — Foundation

## Goal

Produce a runnable, testable foundation that later phases can extend without
changing the core trust, data, or deployment model.

## In scope

- Next.js 16 App Router project with TypeScript, Tailwind CSS, ESLint, and tests.
- Supabase local project configuration.
- Versioned relational schema and row-level security.
- Core entities: staff profiles, tables, table sessions, orders, order lines,
  service requests, feedback, payments, print jobs, and audit logs.
- Database constraints for one active session, idempotency, money, references,
  immutable original customer text, and valid feedback targets.
- Five Thai demo tables.
- A documented, idempotent development-only process that provisions one demo
  account for each staff role through the Auth Admin API.
- Cookie-based staff login/logout.
- Server-enforced role guards for `/kitchen`, `/cashier`, and `/admin`.
- Clearly marked placeholder pages for those protected areas.
- Environment, local development, migration, test, and deployment instructions.

## Out of scope

- Public `/order/{tableToken}` UI or submission endpoint.
- Realtime subscriptions, kitchen workflow, or sound.
- Cashier pricing/payment/closing UI and mutations.
- Customer service requests or feedback UI.
- Admin management screens and QR file generation.
- Print preview, printer adapters, or ESC/POS.
- PWA manifest/service worker and offline claims.

The related tables exist because schema design is a Phase 1 deliverable; their
workflows remain unimplemented until their assigned phases.

## Proposed directory structure

```text
.
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PHASE_1_PLAN.md
│   └── PHASE_1_STATUS.md
├── scripts/
│   └── seed-staff.mjs
├── src/
│   ├── app/
│   │   ├── (staff)/
│   │   │   ├── admin/page.tsx
│   │   │   ├── cashier/page.tsx
│   │   │   ├── kitchen/page.tsx
│   │   │   └── layout.tsx
│   │   ├── login/
│   │   ├── unauthorized/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── modules/
│   │   └── auth/
│   ├── shared/
│   │   ├── env/
│   │   └── supabase/
│   └── proxy.ts
├── supabase/
│   ├── migrations/
│   ├── config.toml
│   └── seed.sql
├── tests/
│   └── foundation/
├── .env.example
├── README.md
└── package.json
```

Feature modules for later phases will be added only when those phases begin.

## Implementation checklist

- [x] Scaffold project and pin supported runtime/package versions.
- [x] Add environment parsing that fails clearly without leaking secrets.
- [x] Add browser/server Supabase clients and session-refresh proxy.
- [x] Create enums, tables, indexes, triggers, and comments in a migration.
- [x] Enable RLS and add role-aware policies.
- [x] Add Thai demo table seed data.
- [x] Add safe development demo-account provisioning.
- [x] Implement login, logout, staff session lookup, and role authorization.
- [x] Add protected placeholder pages and unauthorized state.
- [x] Test access rules and structural database invariants.
- [x] Run a full local Supabase reset and authenticated HTTP session smoke test.
- [x] Run database lint, application lint, typecheck, tests, and production build.
- [x] Record verification evidence and remaining work.

## Phase 1 acceptance criteria

1. A clean local setup can apply migrations and seed five tables.
2. The demo-account command creates KITCHEN, CASHIER, and ADMIN users without
   storing a production secret in Git.
3. Anonymous users are redirected from every staff route to login.
4. Authenticated staff can enter only the route(s) allowed by their server-side
   role; ADMIN can enter all staff routes.
5. Direct Data API access remains protected by RLS.
6. Database constraints prevent two active sessions for one table, duplicate
   idempotent mutations, negative money, and invalid cross-order feedback lines.
7. Lint, typecheck, automated tests, and production build pass.
8. No user-facing functionality assigned to Phase 2 or later is implemented.
