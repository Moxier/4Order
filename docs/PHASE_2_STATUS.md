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

## Pre-Phase 3 hardening

Completed on 2026-08-22:

- Stable order and line source fields, especially `order_number`, are immutable
  and excluded from authenticated UPDATE grants.
- Request limits count UTF-8 bytes actually consumed from the request stream.
- Customer submission has an 8-second abort timeout and one retry using the
  exact same idempotency key for timeout, network, and transient server errors.
- Draft persistence falls back from local to session storage, exposes a clear
  memory-only warning, and rotates a conflicting idempotency key without
  changing the customer's text.
- Same-origin validation uses a mandatory exact-origin allowlist and an explicit
  trusted-proxy mode.
- A committed retry remains recoverable after QR rotation/disable by matching an
  immutable token fingerprint; new requests from the obsolete QR are rejected.
- CI runs on pushes and pull requests with application verification, local
  Supabase reset/lint, pgTAP role-based RLS tests, concurrent database requests,
  and Playwright HTTP/UI retry tests.

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

Hardening verification on 2026-08-22:

| Check | Result |
| --- | --- |
| Vitest | 50/50 tests passed |
| pgTAP | 64/64 assertions passed across foundation, ordering, and role-based RLS suites |
| Concurrent database harness | one receipt per key and one active session passed |
| Playwright production HTTP/UI | 6/6 scenarios passed |
| Database lint | no schema errors or warnings |
| Production build | passed |

## Deliberately incomplete

- Kitchen realtime screen and status workflow
- Customer service requests and feedback
- Cashier pricing, payment, and table close
- Admin tools and history
- Print preview and printer adapters
- PWA/offline and reconnection hardening beyond customer draft retention
