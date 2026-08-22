import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/202608220002_phase_3_kitchen.sql",
  ),
  "utf8",
);

describe("Phase 3 kitchen migration", () => {
  it("removes direct authenticated order updates", () => {
    expect(migration).toContain("revoke update on public.orders from authenticated");
  });

  it("enforces the sequential kitchen workflow and expected status", () => {
    expect(migration).toContain("p_expected_status");
    expect(migration).toContain("kitchen_order_invalid_transition");
    expect(migration).toContain("kitchen_order_status_conflict");
    expect(migration).toMatch(/NEW'[\s\S]*ACKNOWLEDGED'[\s\S]*PREPARING'[\s\S]*DONE'/);
  });

  it("restricts transitions to kitchen and admin roles", () => {
    expect(migration).toContain(
      "array['KITCHEN', 'ADMIN']::public.staff_role[]",
    );
    expect(migration).toContain("kitchen_order_forbidden");
  });

  it("records timestamps and an audit event in the same function", () => {
    expect(migration).toContain("acknowledged_at");
    expect(migration).toContain("preparing_at");
    expect(migration).toContain("completed_at");
    expect(migration).toContain("KITCHEN_ORDER_STATUS_CHANGED");
    expect(migration).toContain("from_status");
    expect(migration).toContain("to_status");
  });

  it("publishes order and line refresh signals through Supabase Realtime", () => {
    expect(migration).toContain("alter publication supabase_realtime add table public.orders");
    expect(migration).toContain(
      "alter publication supabase_realtime add table public.order_lines",
    );
  });
});
