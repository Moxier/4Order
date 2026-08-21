import "server-only";

import type { CustomerOrderInput } from "@/modules/customer/schema";
import { tableTokenSchema } from "@/modules/customer/schema";
import { createServiceSupabaseClient } from "@/shared/supabase/service";

export type PublicTable = {
  name: string;
};

export type SubmittedOrder = {
  duplicate: boolean;
  orderNumber: number;
  tableName: string;
};

export type CustomerOrderErrorCode =
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_ORDER"
  | "INVALID_TABLE"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

export class CustomerOrderError extends Error {
  constructor(
    public readonly code: CustomerOrderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CustomerOrderError";
  }
}

export async function getPublicOrderTable(
  untrustedToken: string,
): Promise<PublicTable | null> {
  const parsedToken = tableTokenSchema.safeParse(untrustedToken);

  if (!parsedToken.success) {
    return null;
  }

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("name")
    .eq("public_token", parsedToken.data)
    .eq("enabled", true)
    .maybeSingle();

  if (error) {
    throw new CustomerOrderError(
      "UNAVAILABLE",
      "Unable to resolve customer table",
    );
  }

  return data ? { name: data.name } : null;
}

export async function submitCustomerOrder(
  input: CustomerOrderInput,
): Promise<SubmittedOrder> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.rpc("submit_customer_order", {
    p_idempotency_key: input.idempotencyKey,
    p_original_text: input.originalText,
    p_table_token: input.tableToken,
  });

  if (error) {
    throw mapDatabaseError(error.message);
  }

  const result = data?.[0];

  if (!result) {
    throw new CustomerOrderError(
      "UNAVAILABLE",
      "Customer order function returned no result",
    );
  }

  return {
    duplicate: result.is_duplicate,
    orderNumber: result.order_number,
    tableName: result.table_name,
  };
}

function mapDatabaseError(message: string): CustomerOrderError {
  if (message.includes("customer_order_invalid_table")) {
    return new CustomerOrderError("INVALID_TABLE", message);
  }

  if (message.includes("customer_order_rate_limited")) {
    return new CustomerOrderError("RATE_LIMITED", message);
  }

  if (message.includes("customer_order_idempotency_conflict")) {
    return new CustomerOrderError("IDEMPOTENCY_CONFLICT", message);
  }

  if (
    message.includes("customer_order_invalid_text") ||
    message.includes("customer_order_line_too_long") ||
    message.includes("customer_order_invalid_idempotency_key")
  ) {
    return new CustomerOrderError("INVALID_ORDER", message);
  }

  return new CustomerOrderError("UNAVAILABLE", message);
}
