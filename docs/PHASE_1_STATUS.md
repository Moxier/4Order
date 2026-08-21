# Phase 1 status

## Outcome

The Phase 1 code and database foundation are implemented. No workflow from
Phase 2 or later has been implemented.

## Implemented

- Next.js 16 modular-monolith scaffold with TypeScript and Tailwind CSS.
- Supabase configuration, versioned PostgreSQL migration, and generated types.
- Staff profiles and the complete core relational model needed by V1.
- Database-level session, idempotency, money, text-preservation, feedback-scope,
  and payment constraints.
- RLS with server-aligned KITCHEN, CASHIER, and ADMIN access.
- Five Thai demo tables with random URL-safe QR tokens.
- Idempotent, local-by-default demo staff provisioning through the supported
  Auth Admin API.
- Cookie-based staff login/logout and session refresh.
- Server-side role guards for `/kitchen`, `/cashier`, and `/admin`.
- Protected Thai placeholder pages that clearly defer operational workflows to
  their specified later phases.
- Local and production setup documentation.

## Verification evidence

Verified on 2026-08-21:

| Check | Result |
| --- | --- |
| `pnpm lint` | passed with no warnings |
| `pnpm typecheck` | passed |
| `pnpm test` | 21/21 tests passed |
| `pnpm build` | production webpack build passed |
| Migration on Supabase PostgreSQL 17.6 | applied successfully |
| Seed applied twice | remained at exactly five tables |
| Supabase database lint | no schema errors |
| pgTAP database suite | 28/28 tests passed |
| Full local Supabase reset | both migrations and seed passed |
| Demo staff provisioning | all three roles passed, including an idempotent rerun |
| App login/authorization matrix | all allowed and denied routes passed |

The database suite executes the actual committed migration and verifies RLS,
anonymous isolation, one-active-session uniqueness, satang types, negative
money rejection, immutable source text, feedback/session scoping, seed data,
tokens, API grants, no staff hard-delete privilege, triggers, and expected
tables.

The authenticated smoke test submitted each login through the real Next.js
Server Action with an isolated cookie jar. Results:

| Account | Kitchen | Cashier | Admin |
| --- | --- | --- | --- |
| KITCHEN | allowed | unauthorized | unauthorized |
| CASHIER | unauthorized | allowed | unauthorized |
| ADMIN | allowed | allowed | allowed |

Anonymous `/kitchen` access redirected to `/login?next=%2Fkitchen` as expected.
The full-stack test discovered and fixed two foundation issues: explicit
`service_role` SQL grants were required for staff provisioning, and the local
email provider had to remain enabled while global public signup stayed off.

Phase 1 has no remaining implementation or smoke-test blocker.

## Deliberately incomplete

- Customer order route and submission
- Transaction-safe order/session creation function
- Kitchen realtime state, sounds, and status actions
- Cashier pricing, payment, and close-table flow
- Customer service requests and feedback submission
- Admin management and history interfaces
- Print preview/PrintService implementation
- PWA and offline/reconnection hardening

These remain assigned to their phases in `SPEC.md`.
