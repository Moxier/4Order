import { describe, expect, it } from "vitest";

import {
  acceptsJsonRequest,
  isSameOriginRequest,
} from "../../src/modules/customer/request-security";

function makeRequest(headers: Record<string, string>) {
  return new Request("https://order.example/api/customer/orders", { headers });
}

const directPolicy = { trustedOrigins: ["https://order.example"] } as const;

describe("public customer request checks", () => {
  it("accepts same-origin JSON requests", () => {
    const request = makeRequest({
      host: "order.example",
      origin: "https://order.example",
      "content-type": "application/json; charset=utf-8",
    });

    expect(isSameOriginRequest(request, directPolicy)).toBe(true);
    expect(acceptsJsonRequest(request)).toBe(true);
  });

  it("ignores spoofed forwarded headers without an explicit proxy policy", () => {
    const request = makeRequest({
      origin: "https://evil.example",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    });

    expect(isSameOriginRequest(request, directPolicy)).toBe(false);
  });

  it("compares the complete origin including protocol and port", () => {
    expect(
      isSameOriginRequest(
        makeRequest({ origin: "http://order.example" }),
        directPolicy,
      ),
    ).toBe(false);
    expect(
      isSameOriginRequest(
        makeRequest({ origin: "https://order.example:444" }),
        directPolicy,
      ),
    ).toBe(false);
  });

  it("accepts overwritten proxy headers only with an exact allowlist", () => {
    const request = new Request("http://internal:3000/api/customer/orders", {
      headers: {
        origin: "https://order.example",
        "x-forwarded-host": "order.example",
        "x-forwarded-proto": "https",
      },
    });

    expect(
      isSameOriginRequest(request, {
        trustedOrigins: ["https://order.example"],
        trustProxyHeaders: true,
      }),
    ).toBe(true);
    expect(
      isSameOriginRequest(request, { trustProxyHeaders: true }),
    ).toBe(false);
  });

  it("rejects ambiguous forwarded chains even in proxy mode", () => {
    const request = new Request("http://internal:3000/api/customer/orders", {
      headers: {
        origin: "https://order.example",
        "x-forwarded-host": "evil.example, order.example",
        "x-forwarded-proto": "https",
      },
    });

    expect(
      isSameOriginRequest(request, {
        trustedOrigins: ["https://order.example"],
        trustProxyHeaders: true,
      }),
    ).toBe(false);
  });

  it("rejects missing and cross-origin requests", () => {
    expect(
      isSameOriginRequest(makeRequest({ host: "order.example" }), directPolicy),
    ).toBe(false);
    expect(
      isSameOriginRequest(
        makeRequest({ host: "order.example", origin: "https://evil.example" }),
        directPolicy,
      ),
    ).toBe(false);
  });

  it("fails closed when no trusted origin allowlist is configured", () => {
    expect(
      isSameOriginRequest(
        makeRequest({ host: "order.example", origin: "https://order.example" }),
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
