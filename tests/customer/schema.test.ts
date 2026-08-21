import { describe, expect, it } from "vitest";

import {
  customerOrderInputSchema,
  customerOrderTextSchema,
  tableTokenSchema,
} from "../../src/modules/customer/schema";

describe("customer order validation", () => {
  it("accepts Thai free-form text without transforming it", () => {
    const originalText = " ข้าวหมกไก่ 2  \n\nกะเพราเนื้อ 1 เผ็ดน้อย ";

    expect(customerOrderTextSchema.parse(originalText)).toBe(originalText);
  });

  it("rejects blank-only text", () => {
    expect(customerOrderTextSchema.safeParse(" \n\t ").success).toBe(false);
  });

  it("rejects an overlong complete order", () => {
    expect(customerOrderTextSchema.safeParse("ก".repeat(8001)).success).toBe(false);
  });

  it("rejects an overlong nonblank line", () => {
    expect(
      customerOrderTextSchema.safeParse(`${"ก".repeat(1001)}\nน้ำเปล่า 1`).success,
    ).toBe(false);
  });

  it("accepts opaque URL-safe table tokens", () => {
    expect(tableTokenSchema.safeParse("t_a8f3Kp92LmN4xY7qR2sV8w").success).toBe(true);
    expect(tableTokenSchema.safeParse("7").success).toBe(false);
  });

  it("requires a UUID idempotency key", () => {
    const input = {
      tableToken: "t_a8f3Kp92LmN4xY7qR2sV8w",
      originalText: "ซุปหางวัว 1",
      idempotencyKey: "not-a-uuid",
    };

    expect(customerOrderInputSchema.safeParse(input).success).toBe(false);
  });
});
