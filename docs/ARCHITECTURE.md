# Architecture

## Decision summary

4Order will be a modular monolith built as one Next.js App Router application.
It will use Supabase for PostgreSQL, staff authentication, and (from Phase 3)
realtime change delivery. The database is the authoritative state; realtime is
only a notification/refresh mechanism.

This keeps deployment and maintenance small enough for one restaurant while
leaving clear boundaries for later hardware integrations.

## Runtime topology

```text
Customer and staff browsers
          |
          | HTTPS
          v
Next.js application
  - responsive pages
  - server actions / route handlers
  - validation and authorization
  - application modules
          |
          | authenticated database/API connection
          v
Supabase
  - PostgreSQL (authoritative state)
  - Auth (staff only)
  - Realtime (staff updates in later phases)

Future local print agent (not V1 hardware integration)
  <- polls/receives PRINT_JOBS through a PrintService adapter
```

## Application boundaries

- `customer`: public table-token resolution, ordering, and customer actions.
- `kitchen`: kitchen read model, order status workflow, and notifications.
- `cashier`: active sessions, line pricing, payments, and table closing.
- `admin`: tables, QR rotation, staff access, history, and daily totals.
- `feedback`: feedback capture, routing, acknowledgement, and resolution.
- `printing`: printer-independent ticket/bill models and print jobs.
- `auth`: Supabase session handling and server-side role checks.
- `db`: database clients and generated PostgreSQL types.

Modules share one deployable application and one relational database. They
should communicate through application functions and database transactions,
not through network services or message brokers.

## Request and trust boundaries

### Public customer traffic

The QR URL contains only a random, revocable table token. A public request is
validated on the server, and the server resolves the table from that token.
The client never supplies a trusted table or session ID separately.

The Phase 2 customer-order mutation is exposed as a narrow same-origin JSON
route handler. It validates all input, uses a server-only service-role client,
and delegates the state change to one PostgreSQL function. That function locks
the table row, creates or reuses the active session, inserts the order and its
nonblank operational lines, rate-limits by table, and returns the original
result for an idempotent retry. Customer text is stored unchanged and rendered
as text, never as HTML.

The route reads and counts request bytes directly before JSON parsing. Its
origin guard compares scheme, hostname, and port against an explicit deployment
allowlist. Forwarded host/protocol headers are accepted only when
`TRUST_PROXY_HEADERS=true`; that mode requires an ingress which overwrites both
headers and rejects ambiguous comma-separated chains.

### Staff traffic

Staff sign in with Supabase email/password authentication. Sessions are held in
securely managed cookies through `@supabase/ssr`. Every protected page and
mutation checks the authenticated user and their `staff_profiles.role` on the
server. PostgreSQL row-level security is a second enforcement layer.

Role access for V1:

| Area | KITCHEN | CASHIER | ADMIN |
| --- | --- | --- | --- |
| Kitchen | yes | no | yes |
| Cashier | no | yes | yes |
| Admin | no | no | yes |

### Privileged credentials

The Supabase service-role key is server-only. It must never use a
`NEXT_PUBLIC_` name or be imported into a client component. It is reserved for
narrow public endpoints, controlled staff provisioning, and server jobs.

## Data and transaction design

- UUIDs are internal primary keys.
- Table QR tokens are random, unique, prefixed opaque strings and are
  independently revocable.
- Only one `ACTIVE` session may exist for a table, enforced by a partial unique
  index rather than application code alone.
- Closing a table is a transaction: validate payment, mark it completed, close
  the session, and record the audit event together.
- Customer submissions carry client-generated UUID idempotency keys. Unique
  constraints make retries return the original result instead of inserting a
  duplicate.
- Orders store an immutable SHA-256 fingerprint of the QR token used for the
  accepted request. A committed request can therefore recover its original
  receipt with the same token, text, and idempotency key after QR rotation or
  table disable; a new request using that obsolete token is rejected.
- Order numbers use a PostgreSQL sequence. Gaps are acceptable; uniqueness and
  stable human-readable references matter more than gapless numbering.
- Monetary values are non-negative integer satang (`bigint`), never floating
  point.
- Original order text and line text are immutable source fields. Corrections or
  pricing never overwrite them.
- Stable receipt/source fields, including `order_number`, IDs, session binding,
  idempotency key, token fingerprint, and creation timestamps, are protected by
  triggers. Authenticated SQL grants expose only operational update columns.
- Cancellation and dismissal use statuses; operational records are not hard
  deleted.
- Important staff changes are recorded in `audit_logs` with actor, action,
  entity, timestamp, and compact JSON metadata.

## Realtime and reconnection (later phase design)

Kitchen and cashier screens will subscribe to relevant Supabase Realtime
changes allowed by RLS. An event tells the client that state changed; it is not
treated as the complete source of truth. Initial load, reconnect, visibility
return, and event gaps all trigger an authoritative query. Client stores merge
by stable IDs, preventing duplicate cards.

Realtime is intentionally not implemented in Phase 1.

## Printing seam (later phase design)

Application code will target a `PrintService` port with operations for kitchen
tickets, bills, and test prints. V1 preview adapters will render HTML with 80mm
print CSS. A future local agent can claim durable `print_jobs` and translate a
printer-neutral payload to ESC/POS without giving the browser raw device
access.

No printer behavior is implemented in Phase 1; only the durable schema seam is
created.

## Deployment

- Web: a Node.js 22+ host suitable for the pinned Next.js and pnpm toolchain
  (for example Vercel).
- Data/Auth: one Supabase project in a nearby region.
- Schema: migrations are committed under `supabase/migrations` and applied with
  the Supabase CLI. Production schema changes do not originate in the dashboard.
- Secrets: deployment environment variables; `.env.local` remains untracked.
- Recovery: Supabase backups plus migration history. Operational monitoring and
  backup policy must be confirmed before live restaurant use.

## Assumptions

- One restaurant, one currency (THB), and one timezone (`Asia/Bangkok`) in V1.
- Staff devices normally have internet access; no local LAN server is required.
- Staff accounts are individually identifiable even if the restaurant initially
  chooses shared role accounts for convenience.
- Table names are display labels and are not parsed as numeric identifiers.
- An active session opens lazily on the first successful customer mutation.
- The restaurant accepts that a hosted cloud outage temporarily prevents new
  orders; the UI must preserve drafts and clearly report failure in later phases.

## Main risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Two first orders create two sessions | Partial unique index plus the Phase 2 table-row lock and transactional database function |
| Network retry duplicates an order | Client UUID idempotency key plus unique database constraint |
| QR token leaks or is guessed | High-entropy token, rate limiting, token rotation, disabled-table check |
| Realtime event is missed | Re-fetch authoritative state after reconnect/focus and merge by ID |
| Browser blocks kitchen sound | Explicit per-device sound enable control and visible permission state |
| Free-form text contains script markup | Validate size and render only escaped text |
| Shared credentials weaken audit trail | Prefer named staff users; always store actor UUID on sensitive changes |
| Direct SQL auth/user seeding becomes brittle | Seed demo staff through the supported Auth Admin API, not `auth.users` inserts |
| Cloud or mobile network interruption | Clear connection state, retained drafts, retry, and operational fallback procedure |
| Thermal printer interface is unknown | Stable PrintService boundary and durable print jobs; defer ESC/POS adapter |

## Explicit non-goals

No microservices, Redis, queue broker, Kubernetes, inventory, menu/catalog,
automatic order interpretation, banking integration, tax invoices, multi-branch
support, or printer-specific integration is part of this architecture or Phase 1.
