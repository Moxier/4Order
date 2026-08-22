export type RequestOriginPolicy = {
  trustedOrigins?: readonly string[];
  trustProxyHeaders?: boolean;
};

export function isSameOriginRequest(
  request: Request,
  policy: RequestOriginPolicy = {},
): boolean {
  const suppliedOrigin = parseOrigin(request.headers.get("origin"));
  if (!suppliedOrigin) {
    return false;
  }

  const trustedOrigins = normalizeTrustedOrigins(policy.trustedOrigins ?? []);
  if (trustedOrigins === null || trustedOrigins.length === 0) {
    return false;
  }

  let expectedOrigin: string;
  if (policy.trustProxyHeaders) {
    // Forwarded headers are accepted only under an explicit proxy policy with
    // an allowlist. The trusted ingress must overwrite, rather than append,
    // these headers; comma-separated chains are rejected as ambiguous.
    const forwardedProtocol = parseSingleForwardedValue(
      request.headers.get("x-forwarded-proto"),
    );
    const forwardedHost = parseSingleForwardedValue(
      request.headers.get("x-forwarded-host"),
    );
    expectedOrigin = parseOriginFromParts(forwardedProtocol, forwardedHost) ?? "";
  } else {
    const directHost = parseSingleForwardedValue(request.headers.get("host"));
    const directProtocol = new URL(request.url).protocol.replace(/:$/, "");
    expectedOrigin = parseOriginFromParts(directProtocol, directHost) ?? "";
  }

  if (!expectedOrigin || suppliedOrigin !== expectedOrigin) {
    return false;
  }

  return trustedOrigins.includes(suppliedOrigin);
}

export function acceptsJsonRequest(request: Request): boolean {
  return request.headers
    .get("content-type")
    ?.toLowerCase()
    .startsWith("application/json") === true;
}

function parseOrigin(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function parseSingleForwardedValue(value: string | null): string | null {
  if (!value || value.includes(",")) {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function parseOriginFromParts(
  protocol: string | null,
  host: string | null,
): string | null {
  if (!protocol || !host || /[\s/?#@]/.test(host)) {
    return null;
  }

  return parseOrigin(`${protocol}://${host}`);
}

function normalizeTrustedOrigins(origins: readonly string[]): string[] | null {
  const normalized: string[] = [];
  for (const origin of origins) {
    const parsed = parseOrigin(origin);
    if (!parsed) {
      return null;
    }
    normalized.push(parsed);
  }
  return normalized;
}
