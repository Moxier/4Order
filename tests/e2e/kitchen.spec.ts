import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

let serviceClient: SupabaseClient;
let tableTokens: Record<string, string>;
const createdIdempotencyKeys = new Set<string>();

async function loginAsKitchen(page: Page) {
  const password = process.env.DEMO_STAFF_PASSWORD;
  if (!password) throw new Error("DEMO_STAFF_PASSWORD is required for kitchen E2E");

  await page.goto("/login?next=/kitchen");
  await page.getByLabel("อีเมล").fill("kitchen@4order.local");
  await page.getByLabel("รหัสผ่าน").fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/kitchen$/);
  await expect(page.getByRole("heading", { name: "หน้าจอครัว" })).toBeVisible();
}

async function submitOrder(tableName: string, originalText: string) {
  const idempotencyKey = randomUUID();
  createdIdempotencyKeys.add(idempotencyKey);
  const { data, error } = await serviceClient.rpc("submit_customer_order", {
    p_table_token: tableTokens[tableName],
    p_original_text: originalText,
    p_idempotency_key: idempotencyKey,
  });
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
  return data![0];
}

test.beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Local Supabase environment is required for kitchen E2E tests");
  }

  serviceClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await serviceClient
    .from("restaurant_tables")
    .select("name, public_token")
    .order("name");
  if (error || !data) throw new Error(`Unable to load E2E tables: ${error?.message}`);
  tableTokens = Object.fromEntries(data.map((table) => [table.name, table.public_token]));
});

test.afterEach(async () => {
  const keys = Array.from(createdIdempotencyKeys);
  createdIdempotencyKeys.clear();
  if (keys.length === 0) return;

  const { data: orders, error: lookupError } = await serviceClient
    .from("orders")
    .select("id, session_id")
    .in("idempotency_key", keys);
  expect(lookupError).toBeNull();
  const orderIds = orders?.map(({ id }) => id) ?? [];
  const sessionIds = Array.from(
    new Set(orders?.map(({ session_id }) => session_id) ?? []),
  );
  if (orderIds.length === 0) return;

  expect(
    (await serviceClient.from("audit_logs").delete().in("entity_id", orderIds)).error,
  ).toBeNull();
  expect(
    (await serviceClient.from("order_lines").delete().in("order_id", orderIds)).error,
  ).toBeNull();
  expect((await serviceClient.from("orders").delete().in("id", orderIds)).error).toBeNull();

  for (const sessionId of sessionIds) {
    const { count, error: countError } = await serviceClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    expect(countError).toBeNull();
    if (count === 0) {
      expect(
        (await serviceClient.from("table_sessions").delete().eq("id", sessionId)).error,
      ).toBeNull();
    }
  }
});

test("kitchen receives a realtime order and advances its audited workflow", async ({
  page,
}) => {
  await loginAsKitchen(page);
  await expect(page.getByText("เชื่อมต่อแล้ว")).toBeVisible();

  await page.getByRole("button", { name: "เปิดเสียงแจ้งเตือน" }).click();
  await expect(page.getByRole("button", { name: "เสียงเปิดอยู่" })).toBeVisible();

  const receipt = await submitOrder("โต๊ะ 01", "ข้าวหมกไก่ 2\nซุปหางวัว 1");
  const card = page.locator(`[data-order-id]`).filter({
    hasText: `Order #${receipt.order_number}`,
  });
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card).toContainText("ข้าวหมกไก่ 2");
  await expect(card).toContainText("ซุปหางวัว 1");

  await card.getByRole("button", { name: "รับออเดอร์" }).click();
  await expect(card.getByRole("button", { name: "เริ่มทำ" })).toBeVisible();
  await card.getByRole("button", { name: "เริ่มทำ" }).click();
  await expect(card.getByRole("button", { name: "ทำเสร็จแล้ว" })).toBeVisible();
  await card.getByRole("button", { name: "ทำเสร็จแล้ว" }).click();
  await expect(card).toContainText("เสร็จแล้ว");

  const { data: order, error: orderError } = await serviceClient
    .from("orders")
    .select("id, status, acknowledged_at, preparing_at, completed_at")
    .eq("order_number", receipt.order_number)
    .single();
  expect(orderError).toBeNull();
  expect(order).toMatchObject({ status: "DONE" });
  expect(order?.acknowledged_at).not.toBeNull();
  expect(order?.preparing_at).not.toBeNull();
  expect(order?.completed_at).not.toBeNull();

  const { count, error: auditError } = await serviceClient
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", order!.id)
    .eq("action", "KITCHEN_ORDER_STATUS_CHANGED");
  expect(auditError).toBeNull();
  expect(count).toBe(3);

  await page.reload();
  await expect(page.getByRole("button", { name: "แตะเพื่อเปิดเสียง" })).toBeVisible();
});

test("kitchen resyncs authoritative orders after reconnecting", async ({
  context,
  page,
}) => {
  await loginAsKitchen(page);
  await expect(page.getByText("เชื่อมต่อแล้ว")).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText(/อุปกรณ์ออฟไลน์/)).toBeVisible();
  const receipt = await submitOrder("โต๊ะ 02", "น้ำเปล่า 2");
  await expect(page.getByText(`Order #${receipt.order_number}`)).toHaveCount(0);

  await context.setOffline(false);
  await expect(page.getByText(`Order #${receipt.order_number}`)).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(/เชื่อมต่อแล้ว/)).toBeVisible({ timeout: 10_000 });
});
