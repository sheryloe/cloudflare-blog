type WindowCounter = {
  count: number;
  expiresAt: number;
};

const buckets = new Map<string, WindowCounter>();

function now() {
  return Date.now();
}

function toKey(parts: Array<string | null | undefined>) {
  return parts.map((part) => (part ?? "").trim()).join(":");
}

function getClientAddress(request: Request) {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function consumeRateLimit(input: {
  request: Request;
  scope: string;
  limit: number;
  windowMs: number;
  subject?: string | null;
}) {
  const current = now();
  const key = toKey([input.scope, getClientAddress(input.request), input.subject ?? null]);
  const existing = buckets.get(key);

  if (!existing || existing.expiresAt <= current) {
    buckets.set(key, {
      count: 1,
      expiresAt: current + input.windowMs,
    });

    return {
      allowed: true,
      remaining: Math.max(0, input.limit - 1),
      resetMs: input.windowMs,
    };
  }

  if (existing.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, existing.expiresAt - current),
    };
  }

  existing.count += 1;
  buckets.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, input.limit - existing.count),
    resetMs: Math.max(0, existing.expiresAt - current),
  };
}

