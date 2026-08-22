# Phase 3 status

## Outcome

The kitchen display is implemented at `/kitchen`. Authenticated KITCHEN and
ADMIN users receive authoritative order cards, realtime refreshes, sequential
status controls, audible notification controls, and automatic reconnect/resync
behavior.

## Implemented

- Server-side initial kitchen query protected by the existing staff session and
  PostgreSQL RLS.
- Responsive Thai kitchen board with separate new, acknowledged, preparing, and
  recently completed sections.
- Complete original customer line text rendered as text in stable line order.
- Audited database RPC for `NEW → ACKNOWLEDGED → PREPARING → DONE` with role
  enforcement, row locking, expected-state conflict detection, and transition
  timestamps.
- Direct authenticated `orders` updates revoked so clients cannot bypass the
  transition RPC.
- `orders` and `order_lines` published as Supabase Realtime refresh signals.
- Explicit staff JWT setup before the Realtime channel joins, avoiding an
  anonymous-subscription race immediately after SSR login.
- Authoritative refetch on initial subscription, every realtime signal,
  reconnect, online event, focus, visibility return, manual refresh, and a
  30-second safety interval.
- New-order sound generated with Web Audio after an explicit operator gesture;
  the preference is remembered locally and autoplay restrictions remain clear.
- Visible connected, reconnecting, and offline states.
- CI provisioning for role-based kitchen browser tests.

## Verification evidence

| Check | Result |
| --- | --- |
| Migration reset | all Phase 1–3 migrations and seed applied |
| Database lint | no schema errors or warnings |
| pgTAP | 85/85 assertions across four suites |
| Vitest | 58/58 tests across ten files |
| Lint | passed with no warnings |
| TypeScript | passed |
| Production build | passed |
| Full production Playwright | 8/8 scenarios passed (6 customer + 2 kitchen) |
| Post-Playwright pgTAP rerun | 85/85 passed; browser cleanup left no conflicting sessions |

## Deliberately incomplete

- Customer call-staff and request-bill actions (Phase 5)
- Cashier pricing, payment, and table close (Phase 4)
- Kitchen cancellation UI; cancelled records are displayed when created by a
  future authorized workflow
- Printer ticket preview and hardware adapter (Phase 7)
- Installation/offline PWA shell (Phase 8)
