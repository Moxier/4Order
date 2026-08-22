import { describe, expect, it, vi } from "vitest";

import {
  CustomerSubmissionError,
  submitCustomerOrderRequest,
} from "../../src/modules/customer/submission";

const input = {
  idempotencyKey: "71000000-0000-4000-8000-000000000001",
  originalText: "ข้าวหมกไก่ 1",
  tableToken: "t_a8f3Kp92LmN4xY7qR2sV8w",
};

describe("customer submission transport", () => {
  it("retries a network failure with the exact same idempotency key", async () => {
    const bodies: string[] = [];
    const fetchImplementation = vi.fn<typeof fetch>(async (_url, init) => {
      bodies.push(String(init?.body));
      if (bodies.length === 1) {
        throw new TypeError("connection reset");
      }
      return Response.json({
        duplicate: true,
        orderNumber: 1001,
        tableName: "โต๊ะ 01",
      });
    });

    await expect(
      submitCustomerOrderRequest(input, {
        fetchImplementation,
        retryDelayMilliseconds: 0,
      }),
    ).resolves.toMatchObject({ orderNumber: 1001 });

    expect(bodies).toHaveLength(2);
    expect(JSON.parse(bodies[0] ?? "{}").idempotencyKey).toBe(
      input.idempotencyKey,
    );
    expect(bodies[1]).toBe(bodies[0]);
  });

  it("aborts a timed-out attempt and retries the same request", async () => {
    const bodies: string[] = [];
    const fetchImplementation = vi.fn<typeof fetch>((_url, init) => {
      bodies.push(String(init?.body));
      if (bodies.length === 2) {
        return Promise.resolve(
          Response.json({
            duplicate: false,
            orderNumber: 1002,
            tableName: "โต๊ะ 01",
          }),
        );
      }

      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });

    await expect(
      submitCustomerOrderRequest(input, {
        fetchImplementation,
        retryDelayMilliseconds: 0,
        timeoutMilliseconds: 5,
      }),
    ).resolves.toMatchObject({ orderNumber: 1002 });
    expect(bodies[1]).toBe(bodies[0]);
  });

  it("does not automatically retry a definitive idempotency conflict", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      Response.json(
        { error: "IDEMPOTENCY_CONFLICT", message: "conflict" },
        { status: 409 },
      ),
    );

    await expect(
      submitCustomerOrderRequest(input, { fetchImplementation }),
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
      retryable: false,
    } satisfies Partial<CustomerSubmissionError>);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
});
