import type { Metadata } from "next";

import { requireStaffSession } from "@/modules/auth/session";
import { fetchKitchenOrders } from "@/modules/kitchen/data";
import { KitchenBoard } from "@/modules/kitchen/kitchen-board";
import { createServerSupabaseClient } from "@/shared/supabase/server";

export const metadata: Metadata = { title: "ครัว" };

export default async function KitchenPage() {
  const session = await requireStaffSession("/kitchen");
  const supabase = await createServerSupabaseClient();
  const initialOrders = await fetchKitchenOrders(supabase);

  return <KitchenBoard initialOrders={initialOrders} staffDisplayName={session.displayName} />;
}
