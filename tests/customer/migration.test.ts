import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = [
  "202608210003_customer_ordering.sql",
  "202608220001_phase_2_hardening.sql",
]
  .map((file) =>
    readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8"),
  )
  .join("\n");

describe("Phase 2 customer-order migration", () => {
  it("locks both the idempotency key and restaurant table before mutation", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toMatch(/from public\.restaurant_tables[\s\S]*for update/);
  });

  it("creates the active session and order in one database function", () => {
    expect(migration).toContain("insert into public.table_sessions");
    expect(migration).toContain("insert into public.orders");
    expect(migration).toContain("insert into public.order_lines");
  });

  it("preserves original text and derives only nonblank operational lines", () => {
    expect(migration).toContain("p_original_text");
    expect(migration).toContain("with ordinality");
    expect(migration).toContain("source.line_text ~ '[^[:space:]]'");
    expect(migration).not.toMatch(/trim\(p_original_text\)/i);
  });

  it("exposes execution only to the server-side service role", () => {
    expect(migration).toMatch(
      /revoke all on function public\.submit_customer_order[\s\S]*from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.submit_customer_order[\s\S]*to service_role/,
    );
  });

  it("implements duplicate-safe retries and per-table rate limiting", () => {
    expect(migration).toContain("customer_order_idempotency_conflict");
    expect(migration).toContain("is_duplicate");
    expect(migration).toContain("recent_order_count >= 5");
  });

  it("authenticates retries with a token fingerprint before current QR validation", () => {
    expect(migration).toContain("submission_table_token_hash");
    expect(migration).toContain("extensions.digest(p_table_token, 'sha256')");
    expect(migration).toMatch(
      /where orders\.idempotency_key = p_idempotency_key[\s\S]*if found[\s\S]*where restaurant_tables\.public_token = p_table_token/,
    );
  });
});
