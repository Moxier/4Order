import type { CustomerOrderInput } from "@/modules/customer/schema";

export type OrderResult = {
  duplicate: boolean;
  orderNumber: number;
  tableName: string;
};

type ErrorPayload = {
  error?: string;
  message?: string;
};

export class CustomerSubmissionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "CustomerSubmissionError";
  }
}

type SubmissionOptions = {
  attempts?: number;
  fetchImplementation?: typeof fetch;
  retryDelayMilliseconds?: number;
  timeoutMilliseconds?: number;
};

const defaultAttempts = 2;
const defaultRetryDelayMilliseconds = 300;
const defaultTimeoutMilliseconds = 8_000;

export async function submitCustomerOrderRequest(
  input: CustomerOrderInput,
  options: SubmissionOptions = {},
): Promise<OrderResult> {
  const attempts = Math.max(1, options.attempts ?? defaultAttempts);
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const retryDelayMilliseconds =
    options.retryDelayMilliseconds ?? defaultRetryDelayMilliseconds;
  const timeoutMilliseconds =
    options.timeoutMilliseconds ?? defaultTimeoutMilliseconds;
  let lastError: CustomerSubmissionError | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);

    try {
      const response = await fetchImplementation("/api/customer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as
        | OrderResult
        | ErrorPayload
        | null;

      if (response.ok && isOrderResult(payload)) {
        return payload;
      }

      const code = payload && "error" in payload ? payload.error : undefined;
      const message =
        payload && "message" in payload && payload.message
          ? payload.message
          : "ยังส่งออเดอร์ไม่ได้ กรุณาลองอีกครั้ง";
      lastError = new CustomerSubmissionError(
        code ?? "INVALID_RESPONSE",
        message,
        isRetryableStatus(response.status),
      );
    } catch (error) {
      if (error instanceof CustomerSubmissionError) {
        lastError = error;
      } else if (controller.signal.aborted) {
        lastError = new CustomerSubmissionError(
          "TIMEOUT",
          "การส่งใช้เวลานานเกินไป ระบบลองส่งซ้ำแล้วแต่ยังไม่สำเร็จ กรุณาลองอีกครั้ง",
          true,
        );
      } else {
        lastError = new CustomerSubmissionError(
          "NETWORK_ERROR",
          "การเชื่อมต่อขัดข้อง รายการของคุณยังอยู่ กรุณาลองอีกครั้ง",
          true,
        );
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!lastError.retryable || attempt === attempts) {
      throw lastError;
    }

    await delay(retryDelayMilliseconds);
  }

  throw (
    lastError ??
    new CustomerSubmissionError(
      "ORDER_UNAVAILABLE",
      "ยังส่งออเดอร์ไม่ได้ กรุณาลองอีกครั้ง",
      true,
    )
  );
}

function isOrderResult(payload: OrderResult | ErrorPayload | null): payload is OrderResult {
  return (
    payload !== null &&
    "orderNumber" in payload &&
    typeof payload.orderNumber === "number" &&
    typeof payload.tableName === "string" &&
    typeof payload.duplicate === "boolean"
  );
}

function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
