export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeds the configured byte limit");
    this.name = "RequestBodyTooLargeError";
  }
}

export class InvalidJsonBodyError extends Error {
  constructor() {
    super("Request body is not valid UTF-8 JSON");
    this.name = "InvalidJsonBodyError";
  }
}

export async function readLimitedJsonBody(
  request: Request,
  maximumBytes: number,
): Promise<unknown> {
  const declaredLength = parseContentLength(
    request.headers.get("content-length"),
  );
  if (declaredLength !== null && declaredLength > maximumBytes) {
    throw new RequestBodyTooLargeError();
  }

  if (!request.body) {
    throw new InvalidJsonBodyError();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      receivedBytes += value.byteLength;
      if (receivedBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      throw error;
    }
    throw new InvalidJsonBodyError();
  }
}

function parseContentLength(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
