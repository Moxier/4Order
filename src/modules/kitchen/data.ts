import type { SupabaseClient } from "@supabase/supabase-js";

import {
  activeKitchenStatuses,
  completedKitchenStatuses,
  type KitchenOrder,
  type KitchenOrderStatus,
} from "@/modules/kitchen/model";
import type { Database } from "@/shared/supabase/database.generated";

const kitchenOrderSelection = `
  id,
  order_number,
  status,
  created_at,
  updated_at,
  acknowledged_at,
  preparing_at,
  completed_at,
  cancelled_at,
  order_lines (
    id,
    line_number,
    original_text
  ),
  table_sessions!inner (
    restaurant_tables!inner (
      name
    )
  )
`;

type RawKitchenOrder = {
  id: string;
  order_number: number;
  status: KitchenOrderStatus;
  created_at: string;
  updated_at: string;
  acknowledged_at: string | null;
  preparing_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  order_lines: Array<{
    id: string;
    line_number: number;
    original_text: string;
  }>;
  table_sessions:
    | {
        restaurant_tables: { name: string } | Array<{ name: string }>;
      }
    | Array<{
        restaurant_tables: { name: string } | Array<{ name: string }>;
      }>;
};

function firstRelation<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

function mapKitchenOrder(row: RawKitchenOrder): KitchenOrder {
  const session = firstRelation(row.table_sessions);
  const table = firstRelation(session.restaurant_tables);

  if (!session || !table) {
    throw new Error("ข้อมูลโต๊ะของออเดอร์ไม่สมบูรณ์");
  }

  return {
    id: row.id,
    orderNumber: row.order_number,
    tableName: table.name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    acknowledgedAt: row.acknowledged_at,
    preparingAt: row.preparing_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    lines: [...row.order_lines]
      .sort((left, right) => left.line_number - right.line_number)
      .map((line) => ({
        id: line.id,
        lineNumber: line.line_number,
        originalText: line.original_text,
      })),
  };
}

export async function fetchKitchenOrders(
  supabase: SupabaseClient<Database>,
): Promise<KitchenOrder[]> {
  const [activeResult, completedResult] = await Promise.all([
    supabase
      .from("orders")
      .select(kitchenOrderSelection)
      .in("status", [...activeKitchenStatuses])
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select(kitchenOrderSelection)
      .in("status", [...completedKitchenStatuses])
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const error = activeResult.error ?? completedResult.error;
  if (error) {
    throw new Error(`โหลดออเดอร์ครัวไม่สำเร็จ: ${error.message}`);
  }

  const rows = [
    ...((activeResult.data ?? []) as unknown as RawKitchenOrder[]),
    ...((completedResult.data ?? []) as unknown as RawKitchenOrder[]),
  ];
  const uniqueRows = new Map(rows.map((row) => [row.id, row]));

  return Array.from(uniqueRows.values()).map(mapKitchenOrder);
}
