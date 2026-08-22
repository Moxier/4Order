import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: table, error: tableError } = await supabase
  .from("restaurant_tables")
  .select("id, public_token")
  .eq("name", "โต๊ะ 02")
  .eq("enabled", true)
  .single();

if (tableError || !table) {
  throw new Error(`Unable to load concurrency test table: ${tableError?.message}`);
}

const { data: activeSessionsBefore, error: sessionsBeforeError } = await supabase
  .from("table_sessions")
  .select("id")
  .eq("table_id", table.id)
  .eq("status", "ACTIVE");
assert.equal(sessionsBeforeError, null, sessionsBeforeError?.message);

const repeatedKey = randomUUID();
const secondKey = randomUUID();
const repeatedText = `concurrent retry ${repeatedKey}`;
const secondText = `concurrent first order ${secondKey}`;
const requests = [
  ...Array.from({ length: 6 }, () => ({
    p_idempotency_key: repeatedKey,
    p_original_text: repeatedText,
    p_table_token: table.public_token,
  })),
  {
    p_idempotency_key: secondKey,
    p_original_text: secondText,
    p_table_token: table.public_token,
  },
];

const responses = await Promise.all(
  requests.map((parameters) =>
    supabase.rpc("submit_customer_order", parameters),
  ),
);

for (const response of responses) {
  assert.equal(response.error, null, response.error?.message);
  assert.equal(response.data?.length, 1);
}

const repeatedNumbers = responses
  .slice(0, 6)
  .map((response) => response.data?.[0]?.order_number);
assert.equal(new Set(repeatedNumbers).size, 1, "retries returned different receipts");

const { data: orders, error: ordersError } = await supabase
  .from("orders")
  .select("id, idempotency_key, session_id")
  .in("idempotency_key", [repeatedKey, secondKey]);

assert.equal(ordersError, null, ordersError?.message);
assert.equal(orders?.length, 2, "concurrent requests inserted the wrong order count");
assert.equal(
  new Set(orders?.map((order) => order.session_id)).size,
  1,
  "concurrent first orders created more than one active session",
);

console.log(
  "Concurrent database test passed: one receipt per key and one active session.",
);

const createdOrderIds = orders?.map((order) => order.id) ?? [];
if (createdOrderIds.length > 0) {
  const { error: lineCleanupError } = await supabase
    .from("order_lines")
    .delete()
    .in("order_id", createdOrderIds);
  assert.equal(lineCleanupError, null, lineCleanupError?.message);
}

const { error: orderCleanupError } = await supabase
  .from("orders")
  .delete()
  .in("idempotency_key", [repeatedKey, secondKey]);
assert.equal(orderCleanupError, null, orderCleanupError?.message);

if (activeSessionsBefore?.length === 0) {
  const createdSessionId = orders?.[0]?.session_id;
  if (createdSessionId) {
    const { error: sessionCleanupError } = await supabase
      .from("table_sessions")
      .delete()
      .eq("id", createdSessionId);
    assert.equal(sessionCleanupError, null, sessionCleanupError?.message);
  }
}
