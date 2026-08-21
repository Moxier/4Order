import { describe, expect, it } from "vitest";

import {
  acceptsJsonRequest,
  isSameOriginRequest,
} from "../../src/modules/customer/request-security";

function makeRequest(headers: Record<string, string>) {
  return new Request("https://order.example/api/customer/orders", { headers });
}

describe("public customer request checks", () => {
  it("accepts same-origin JSON requests", () => {
    const request = makeRequest({
      host: "order.example",
      origin: "https://order.example",
      "content-type": "application/json; charset=utf-8",
    });

    expect(isSameOriginRequest(request)).toBe(true);
    expect(acceptsJsonRequest(request)).toBe(true);
  });

  it("uses the first forwarded host from a trusted proxy chain", () => {
    const request = makeRequest({
      host: "internal:3000",
      origin: "https://order.example",
      "x-forwarded-host": "order.example, internal:3000",
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("rejects missing and cross-origin requests", () => {
    expect(isSameOriginRequest(makeRequest({ host: "order.example" }))).toBe(false);
    expect(
      isSameOriginRequest(
        makeRequest({ host: "order.example", origin: "https://evil.example" }),
      ),
    ).toBe(false);
  });

  it("rejects non-JSON content types", () => {
    expect(
      acceptsJsonRequest(
        makeRequest({ "content-type": "application/x-www-form-urlencoded" }),
      ),
    ).toBe(false);
  });
});
