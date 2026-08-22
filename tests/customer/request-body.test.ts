import { describe, expect, it } from "vitest";

import {
  InvalidJsonBodyError,
  readLimitedJsonBody,
  RequestBodyTooLargeError,
} from "../../src/modules/customer/request-body";

describe("limited JSON request reader", () => {
  it("measures UTF-8 bytes actually read instead of trusting Content-Length", async () => {
    const body = JSON.stringify({ originalText: "ก".repeat(10) });
    const request = new Request("https://order.example/api/customer/orders", {
      method: "POST",
      headers: {
        "content-length": "1",
        "content-type": "application/json",
      },
      body,
    });

    await expect(readLimitedJsonBody(request, 20)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("rejects a declared oversized body before parsing", async () => {
    const request = new Request("https://order.example/api/customer/orders", {
      method: "POST",
      headers: { "content-length": "12001" },
      body: "{}",
    });

    await expect(readLimitedJsonBody(request, 12_000)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("returns parsed JSON within the byte limit", async () => {
    const request = new Request("https://order.example/api/customer/orders", {
      method: "POST",
      body: JSON.stringify({ value: "น้ำ" }),
    });

    await expect(readLimitedJsonBody(request, 100)).resolves.toEqual({
      value: "น้ำ",
    });
  });

  it("rejects malformed JSON", async () => {
    const request = new Request("https://order.example/api/customer/orders", {
      method: "POST",
      body: "{",
    });

    await expect(readLimitedJsonBody(request, 100)).rejects.toBeInstanceOf(
      InvalidJsonBodyError,
    );
  });
});
