import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = [
  "202608210001_foundation.sql",
  "202608210002_api_grants.sql",
    "202608210003_customer_ordering.sql",
    "202608220001_phase_2_hardening.sql",
]
  .map((file) => readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8"))
  .join("\n");

const coreTables = [
  "staff_profiles",
  "restaurant_tables",
  "table_sessions",
  "orders",
  "order_lines",
  "service_requests",
  "feedback",
  "payments",
  "print_jobs",
  "audit_logs",
] as const;

describe("foundation migration", () => {
  it.each(coreTables)("creates and enables RLS for %s", (table) => {
    expect(migration).toContain(`create table public.${table}`);
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  });

  it("enforces one active session for each table", () => {
    expect(migration).toMatch(
      /create unique index table_sessions_one_active_per_table[\s\S]*where status = 'ACTIVE'/,
    );
  });

  it("stores all monetary fields as integers with nonnegative checks", () => {
    expect(migration).toMatch(/price_amount bigint/);
    expect(migration).toMatch(/amount bigint not null check \(amount >= 0\)/);
    expect(migration).toMatch(/amount_received bigint/);
    expect(migration).toMatch(/change_amount bigint/);
    expect(migration).not.toMatch(/\b(real|double precision|money)\b/i);
  });

  it("gives every public customer mutation an idempotency constraint", () => {
    const occurrences = migration.match(/idempotency_key uuid not null unique/g) ?? [];
    expect(occurrences).toHaveLength(4);
  });

  it("protects exact customer order and line text from updates", () => {
    expect(migration).toContain("create trigger orders_preserve_customer_text");
    expect(migration).toContain("create trigger order_lines_preserve_customer_text");
    expect(migration).toContain("customer order source fields are immutable");
    expect(migration).toContain("customer order line source fields are immutable");
    expect(migration).toContain("new.order_number is distinct from old.order_number");
    expect(migration).toMatch(/revoke update on public\.orders from authenticated/);
    expect(migration).toMatch(/grant update \([\s\S]*status,[\s\S]*\) on public\.orders to authenticated/);
  });

  it("does not grant an anonymous public-table policy", () => {
    expect(migration).not.toMatch(/create policy[\s\S]{0,120}\bto anon\b/i);
  });

  it("grants service-role access without granting staff hard deletes", () => {
    expect(migration).toContain("grant all privileges on all tables in schema public to service_role");
    expect(migration).not.toMatch(/grant[\s\S]{0,80}\bdelete\b[\s\S]{0,80}\bto authenticated/i);
    expect(migration).not.toMatch(/for delete to authenticated/i);
  });
});
