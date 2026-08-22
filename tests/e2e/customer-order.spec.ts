import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

const appOrigin = "http://127.0.0.1:3000";
let serviceClient: SupabaseClient;
let tableTokens: Record<string, string>;
const createdIdempotencyKeys = new Set<string>();

test.beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Local Supabase environment is required for E2E tests");
  }

  serviceClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await serviceClient
    .from("restaurant_tables")
    .select("name, public_token")
    .order("name");
  if (error || !data) {
    throw new Error(`Unable to load E2E tables: ${error?.message}`);
  }
  tableTokens = Object.fromEntries(
    data.map((table) => [table.name, table.public_token]),
  );
});

test.afterEach(async () => {
  const keys = Array.from(createdIdempotencyKeys);
  createdIdempotencyKeys.clear();
  if (keys.length === 0) {
    return;
  }

  const { data: orders, error: orderLookupError } = await serviceClient
    .from("orders")
    .select("id, session_id")
    .in("idempotency_key", keys);
  expect(orderLookupError).toBeNull();

  const orderIds = orders?.map((order) => order.id) ?? [];
  const sessionIds = Array.from(
    new Set(orders?.map((order) => order.session_id) ?? []),
  );
  if (orderIds.length > 0) {
    const { error: lineDeleteError } = await serviceClient
      .from("order_lines")
      .delete()
      .in("order_id", orderIds);
    expect(lineDeleteError).toBeNull();
  }

  const { error: orderDeleteError } = await serviceClient
    .from("orders")
    .delete()
    .in("idempotency_key", keys);
  expect(orderDeleteError).toBeNull();

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

test("real HTTP submission is idempotent and enforces the full origin", async ({
  request,
}) => {
  const input = {
    tableToken: tableTokens["โต๊ะ 01"],
    originalText: "ข้าวหมกไก่ 1",
    idempotencyKey: randomUUID(),
  };
  createdIdempotencyKeys.add(input.idempotencyKey);
  const headers = { origin: appOrigin };

  const first = await request.post("/api/customer/orders", { data: input, headers });
  expect(first.ok()).toBe(true);
  const firstPayload = await first.json();

  const retry = await request.post("/api/customer/orders", { data: input, headers });
  expect(retry.ok()).toBe(true);
  await expect(retry.json()).resolves.toMatchObject({
    duplicate: true,
    orderNumber: firstPayload.orderNumber,
  });

  const spoofed = await request.post("/api/customer/orders", {
    data: { ...input, idempotencyKey: randomUUID() },
    headers: {
      origin: "https://127.0.0.1:3000",
      "x-forwarded-host": "127.0.0.1:3000",
      "x-forwarded-proto": "https",
    },
  });
  expect(spoofed.status()).toBe(403);
});

test("real HTTP body limit counts received UTF-8 bytes", async ({ request }) => {
  const response = await request.post("/api/customer/orders", {
    data: {
      tableToken: tableTokens["โต๊ะ 01"],
      originalText: "ก".repeat(5_000),
      idempotencyKey: randomUUID(),
    },
    headers: { origin: appOrigin },
  });

  expect(response.status()).toBe(413);
  await expect(response.json()).resolves.toMatchObject({ error: "ORDER_TOO_LARGE" });
});

test("UI retries a network failure with the same idempotency key", async ({
  page,
}) => {
  const requestBodies: Array<Record<string, string>> = [];
  await page.route("**/api/customer/orders", async (route) => {
    const body = route.request().postDataJSON() as Record<string, string>;
    requestBodies.push(body);
    createdIdempotencyKeys.add(body.idempotencyKey ?? "");
    if (requestBodies.length === 1) {
      await route.abort("connectionreset");
      return;
    }
    await route.fallback();
  });

  await page.goto(`/order/${tableTokens["โต๊ะ 02"]}`);
  await page.getByRole("textbox").fill("ซุปหางวัว 1");
  await page.getByRole("button", { name: "ตรวจสอบรายการ" }).click();
  await page.getByRole("button", { name: "ยืนยันส่งออเดอร์" }).click();

  await expect(page.getByText("ส่งออเดอร์แล้ว")).toBeVisible();
  expect(requestBodies).toHaveLength(2);
  expect(requestBodies[1]?.idempotencyKey).toBe(
    requestBodies[0]?.idempotencyKey,
  );
  expect(requestBodies[1]?.originalText).toBe("ซุปหางวัว 1");
});

test("UI recovers an idempotency conflict without changing the text", async ({
  page,
  request,
}) => {
  const tableToken = tableTokens["โต๊ะ 03"];
  const conflictingKey = randomUUID();
  createdIdempotencyKeys.add(conflictingKey);
  const first = await request.post("/api/customer/orders", {
    data: {
      tableToken,
      originalText: "ข้อความเก่าที่ส่งสำเร็จ",
      idempotencyKey: conflictingKey,
    },
    headers: { origin: appOrigin },
  });
  expect(first.ok()).toBe(true);

  const recoveredText = "ข้อความใหม่ต้องไม่หาย";
  const storageKey = `4order:customer-draft:${tableToken}`;
  await page.addInitScript(
    ({ key, draft }) => localStorage.setItem(key, JSON.stringify(draft)),
    {
      key: storageKey,
      draft: { idempotencyKey: conflictingKey, originalText: recoveredText },
    },
  );

  const submittedBodies: Array<Record<string, string>> = [];
  page.on("request", (outgoingRequest) => {
    if (outgoingRequest.url().endsWith("/api/customer/orders")) {
      submittedBodies.push(
        outgoingRequest.postDataJSON() as Record<string, string>,
      );
      const key = (outgoingRequest.postDataJSON() as Record<string, string>)[
        "idempotencyKey"
      ];
      if (key) {
        createdIdempotencyKeys.add(key);
      }
    }
  });

  await page.goto(`/order/${tableToken}`);
  await expect(page.getByRole("textbox")).toHaveValue(recoveredText);
  await page.getByRole("button", { name: "ตรวจสอบรายการ" }).click();
  await page.getByRole("button", { name: "ยืนยันส่งออเดอร์" }).click();

  await expect(page.getByText("ส่งออเดอร์แล้ว")).toBeVisible();
  expect(submittedBodies).toHaveLength(2);
  expect(submittedBodies[0]?.idempotencyKey).toBe(conflictingKey);
  expect(submittedBodies[1]?.idempotencyKey).not.toBe(conflictingKey);
  expect(submittedBodies.map((body) => body.originalText)).toEqual([
    recoveredText,
    recoveredText,
  ]);
});

test("storage failure keeps the draft in memory and warns the customer", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "QuotaExceededError");
    };
  });
  await page.route("**/api/customer/orders", (route) =>
    route.abort("connectionreset"),
  );

  await page.goto(`/order/${tableTokens["โต๊ะ 04"]}`);
  const text = "รายการนี้ต้องยังอยู่";
  await page.getByRole("textbox").fill(text);
  await expect(page.getByRole("status")).toContainText("อย่าปิดหรือรีเฟรช");
  await page.getByRole("button", { name: "ตรวจสอบรายการ" }).click();
  await page.getByRole("button", { name: "ยืนยันส่งออเดอร์" }).click();
  await expect(page.getByText(/การเชื่อมต่อขัดข้อง/)).toBeVisible();
  await page.getByRole("button", { name: "แก้ไขรายการ" }).click();
  await expect(page.getByRole("textbox")).toHaveValue(text);
});

test("committed retry survives QR rotation and disable but a new request does not", async ({
  request,
}) => {
  const originalToken = tableTokens["โต๊ะ 05"];
  const idempotencyKey = randomUUID();
  createdIdempotencyKeys.add(idempotencyKey);
  const originalText = "ชาเย็น 1";
  const headers = { origin: appOrigin };
  const first = await request.post("/api/customer/orders", {
    data: { tableToken: originalToken, originalText, idempotencyKey },
    headers,
  });
  expect(first.ok()).toBe(true);
  const receipt = await first.json();

  const rotatedToken = `t_${randomUUID().replaceAll("-", "")}`;
  const { error: rotateError } = await serviceClient
    .from("restaurant_tables")
    .update({ public_token: rotatedToken, enabled: false })
    .eq("name", "โต๊ะ 05");
  expect(rotateError).toBeNull();

  try {
    const retry = await request.post("/api/customer/orders", {
      data: { tableToken: originalToken, originalText, idempotencyKey },
      headers,
    });
    expect(retry.ok()).toBe(true);
    await expect(retry.json()).resolves.toMatchObject({
      duplicate: true,
      orderNumber: receipt.orderNumber,
    });

    const newRequest = await request.post("/api/customer/orders", {
      data: {
        tableToken: originalToken,
        originalText: "ชาเย็นเพิ่ม 1",
        idempotencyKey: randomUUID(),
      },
      headers,
    });
    expect(newRequest.status()).toBe(404);
  } finally {
    await serviceClient
      .from("restaurant_tables")
      .update({ public_token: originalToken, enabled: true })
      .eq("name", "โต๊ะ 05");
  }
});
