# Phase 3 plan: Kitchen display

## Goal

Deliver an authenticated `/kitchen` workflow that receives customer orders in
real time, keeps PostgreSQL authoritative, advances orders through the minimum
kitchen states, notifies the device without assuming autoplay permission, and
recovers safely after a connection gap.

## Scope

- Server-rendered authoritative initial order load for KITCHEN and ADMIN.
- Responsive cards for `NEW`, `ACKNOWLEDGED`, `PREPARING`, `DONE`, and
  `CANCELLED` orders.
- Sequential `NEW → ACKNOWLEDGED → PREPARING → DONE` controls.
- Transactional role validation, expected-state conflict detection, transition
  timestamps, and audit records.
- Supabase Realtime notifications for order and order-line changes.
- Authoritative resync on subscription, reconnect, browser focus, visibility
  return, a manual refresh, and a 30-second safety interval.
- Device-local sound preference with an explicit user gesture before audio.
- Database, unit, production HTTP/UI, role, and reconnect coverage in CI.

## Design decisions

### Database owns status transitions

Authenticated clients do not receive direct `UPDATE` access to `orders`.
Kitchen changes use one `SECURITY DEFINER` RPC which verifies the authenticated
role, locks the order, checks the caller's expected current state, changes the
status and timestamp, and inserts an audit event in the same transaction.

### Realtime is a refresh signal

Realtime payloads are never merged as authoritative records. Any order or line
event schedules a fresh RLS-protected query. The client also refetches after
reconnect and browser visibility changes, so a missed or duplicated event
cannot leave the kitchen board permanently stale or duplicate a card.

### Sound requires an explicit gesture

The device remembers whether sound was requested, but a reload still asks the
operator to tap once before creating/resuming Web Audio. This follows browser
autoplay rules and makes a blocked sound state visible instead of silently
failing.

## Acceptance criteria

- A submitted customer order appears on an already-open kitchen page without a
  manual refresh.
- A stale device cannot repeat or skip a status transition.
- Each successful transition records the correct timestamp and actor audit.
- Cashier, disabled staff, and anonymous callers cannot perform kitchen
  transitions; KITCHEN and ADMIN can.
- Offline state is obvious and an order created during the gap appears after
  connectivity returns without reloading the page.
- Cards remain unique because every resync replaces the read model by stable ID.
- Phone, tablet, and desktop layouts remain usable.
