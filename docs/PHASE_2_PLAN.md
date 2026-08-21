# Phase 2 — Customer QR ordering

## Goal

Deliver the complete public customer flow from a valid table QR URL through an
authoritative, retry-safe order receipt. Keep V1's intentionally free-form
ordering model; there is no product catalog or automatic interpretation.

## In scope

- Public `/order/{tableToken}` route with server-side token resolution.
- Enabled-table validation without exposing table UUIDs.
- Mobile-first Thai text entry, confirmation, edit, submit, and success states.
- Exact preservation of the customer's full text and each nonblank source line.
- Browser-local draft retention after refresh or network failure.
- Client-generated UUID idempotency keys and double-submit prevention.
- Transaction-safe creation or reuse of one active table session.
- Additional orders on the same active session.
- Per-table public submission rate limiting.
- Same-origin JSON route handler and server-only service-role access.
- Database, validation, request-security, HTTP, and browser-flow tests.

## Out of scope

- Kitchen realtime delivery, notifications, sounds, or order status actions.
- Customer call-staff, request-bill, or feedback actions.
- Cashier pricing, payments, bills, and table closing.
- Admin table/QR management and history screens.
- Print preview, printer integration, PWA installation, and offline-order claims.
- Menu/catalog selection or automatic parsing/pricing of customer text.

## Acceptance criteria

1. A valid enabled table token renders the Thai order page; invalid and disabled
   tokens do not expose a customer form.
2. Blank or oversized input is rejected, while accepted text is stored exactly.
3. The customer must review the order before submission and sees success only
   after a successful server response.
4. Retrying the same request returns the same order number and creates exactly
   one order.
5. Two orders from one table reuse its active session.
6. Concurrent first-order creation is serialized by the database and backed by
   the one-active-session unique index.
7. Draft text remains locally available after a failed request.
8. Anonymous callers cannot execute the database mutation directly.
9. Public requests are input-validated, same-origin, size-limited, and
   rate-limited.
10. Phase 1 and Phase 2 automated verification and the production build pass.
