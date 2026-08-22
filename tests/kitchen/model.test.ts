import { describe, expect, it } from "vitest";

import {
  findNewOrderIds,
  getNextKitchenStatus,
  groupKitchenOrders,
  type KitchenOrder,
} from "../../src/modules/kitchen/model";

function order(id: string, status: KitchenOrder["status"]): KitchenOrder {
  return {
    id,
    orderNumber: Number(id),
    tableName: `โต๊ะ ${id}`,
    status,
    createdAt: "2026-08-22T10:00:00.000Z",
    updatedAt: "2026-08-22T10:00:00.000Z",
    acknowledgedAt: null,
    preparingAt: null,
    completedAt: null,
    cancelledAt: null,
    lines: [],
  };
}

describe("kitchen order model", () => {
  it("allows only the next sequential workflow status", () => {
    expect(getNextKitchenStatus("NEW")).toBe("ACKNOWLEDGED");
    expect(getNextKitchenStatus("ACKNOWLEDGED")).toBe("PREPARING");
    expect(getNextKitchenStatus("PREPARING")).toBe("DONE");
    expect(getNextKitchenStatus("DONE")).toBeNull();
    expect(getNextKitchenStatus("CANCELLED")).toBeNull();
  });

  it("notifies only for genuinely unseen NEW orders", () => {
    const known = new Set(["1"]);
    expect(
      findNewOrderIds(known, [
        order("1", "NEW"),
        order("2", "ACKNOWLEDGED"),
        order("3", "NEW"),
      ]),
    ).toEqual(["3"]);
  });

  it("groups active and terminal statuses for distinct kitchen sections", () => {
    const grouped = groupKitchenOrders([
      order("1", "NEW"),
      order("2", "ACKNOWLEDGED"),
      order("3", "PREPARING"),
      order("4", "DONE"),
      order("5", "CANCELLED"),
    ]);

    expect(grouped.newOrders.map(({ id }) => id)).toEqual(["1"]);
    expect(grouped.acknowledgedOrders.map(({ id }) => id)).toEqual(["2"]);
    expect(grouped.preparingOrders.map(({ id }) => id)).toEqual(["3"]);
    expect(grouped.completedOrders.map(({ id }) => id)).toEqual(["4", "5"]);
  });
});
