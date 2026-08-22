import type { Database } from "@/shared/supabase/database.generated";

export type KitchenOrderStatus = Database["public"]["Enums"]["order_status"];

export type KitchenOrderLine = {
  id: string;
  lineNumber: number;
  originalText: string;
};

export type KitchenOrder = {
  id: string;
  orderNumber: number;
  tableName: string;
  status: KitchenOrderStatus;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt: string | null;
  preparingAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  lines: KitchenOrderLine[];
};

export const activeKitchenStatuses = [
  "NEW",
  "ACKNOWLEDGED",
  "PREPARING",
] as const satisfies readonly KitchenOrderStatus[];

export const completedKitchenStatuses = [
  "DONE",
  "CANCELLED",
] as const satisfies readonly KitchenOrderStatus[];

const nextStatus: Partial<Record<KitchenOrderStatus, KitchenOrderStatus>> = {
  NEW: "ACKNOWLEDGED",
  ACKNOWLEDGED: "PREPARING",
  PREPARING: "DONE",
};

export function getNextKitchenStatus(
  status: KitchenOrderStatus,
): KitchenOrderStatus | null {
  return nextStatus[status] ?? null;
}

export function findNewOrderIds(
  knownOrderIds: ReadonlySet<string>,
  orders: readonly KitchenOrder[],
): string[] {
  return orders
    .filter((order) => order.status === "NEW" && !knownOrderIds.has(order.id))
    .map((order) => order.id);
}

export function groupKitchenOrders(orders: readonly KitchenOrder[]) {
  return {
    newOrders: orders.filter((order) => order.status === "NEW"),
    acknowledgedOrders: orders.filter(
      (order) => order.status === "ACKNOWLEDGED",
    ),
    preparingOrders: orders.filter((order) => order.status === "PREPARING"),
    completedOrders: orders.filter(
      (order) => order.status === "DONE" || order.status === "CANCELLED",
    ),
  };
}
