# Phase 2 status

## Outcome

The customer QR ordering flow is implemented. No kitchen, cashier, service
request, feedback, admin, print, or PWA workflow from a later phase is included.

## Implemented

- Server-resolved `/order/{tableToken}` page for enabled opaque QR tokens.
- Mobile-first Thai free-form order entry with edit, confirmation, authoritative
  success, and additional-order states.
- Local draft and idempotency-key retention across refresh and failed retries.
- Same-origin JSON submission route with Zod validation and safe Thai errors.
- Server-only Supabase service client; no privileged key enters the client graph.
- One PostgreSQL transaction function for token resolution, table-row locking,
  active-session reuse/creation, order and line insertion, idempotent retry, and
  per-table rate limiting.
- Generated database types for the new function.
- pgTAP, Vitest, real HTTP, and interactive browser-flow coverage.

## Verification evidence

Verified on 2026-08-21:

| Check | Result |
| --- | --- |
| Clean local Supabase reset | all three migrations and seed applied |
| pgTAP database suites | 49/49 assertions passed |
| Vitest | 36/36 tests passed |
| `pnpm lint` | passed with no warnings |
| `pnpm typecheck` | passed |
| `pnpm build` | production webpack build passed |
| Supabase database lint | no schema errors or warnings |
| Real HTTP QR page | valid 200; invalid 404 |
| Same-origin guard | missing origin rejected with 403 |
| Idempotent HTTP retry | first and retry returned the same order number |
| Interactive Thai flow | edit/confirm/success/additional-order states passed |

## Deliberately incomplete

- Kitchen realtime screen and status workflow
- Customer service requests and feedback
- Cashier pricing, payment, and table close
- Admin tools and history
- Print preview and printer adapters
- PWA/offline and reconnection hardening beyond customer draft retention
