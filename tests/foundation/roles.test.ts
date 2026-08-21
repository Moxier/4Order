import { describe, expect, it } from "vitest";

import {
  canAccessStaffRoute,
  defaultRouteForRole,
  isStaffRole,
  parseStaffRoute,
} from "../../src/modules/auth/roles";

describe("staff authorization matrix", () => {
  it("allows kitchen staff only into the kitchen area", () => {
    expect(canAccessStaffRoute("KITCHEN", "/kitchen")).toBe(true);
    expect(canAccessStaffRoute("KITCHEN", "/cashier")).toBe(false);
    expect(canAccessStaffRoute("KITCHEN", "/admin")).toBe(false);
  });

  it("allows cashier staff only into the cashier area", () => {
    expect(canAccessStaffRoute("CASHIER", "/kitchen")).toBe(false);
    expect(canAccessStaffRoute("CASHIER", "/cashier")).toBe(true);
    expect(canAccessStaffRoute("CASHIER", "/admin")).toBe(false);
  });

  it("allows administrators into every staff area", () => {
    expect(canAccessStaffRoute("ADMIN", "/kitchen")).toBe(true);
    expect(canAccessStaffRoute("ADMIN", "/cashier")).toBe(true);
    expect(canAccessStaffRoute("ADMIN", "/admin")).toBe(true);
  });

  it("maps roles to safe default routes", () => {
    expect(defaultRouteForRole("KITCHEN")).toBe("/kitchen");
    expect(defaultRouteForRole("CASHIER")).toBe("/cashier");
    expect(defaultRouteForRole("ADMIN")).toBe("/admin");
  });

  it("rejects unknown roles and untrusted redirect routes", () => {
    expect(isStaffRole("OWNER")).toBe(false);
    expect(parseStaffRoute("https://example.com")).toBeNull();
    expect(parseStaffRoute("/order/token")).toBeNull();
  });
});
