import type { AppEnv } from "../types";

type IpType = "ipv4" | "ipv6";
type IpRange = {
  start: number;
  end: number;
};

type IpCheckResult = "ok" | "not_configured" | "denied";

function normalizeIp(raw: string) {
  let value = raw.trim();

  if (!value) {
    return "";
  }

  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1).trim();
  }

  const ipv4WithPort = /^\d+\.\d+\.\d+\.\d+:\d+$/;
  if (ipv4WithPort.test(value)) {
    value = value.split(":")[0]!;
  }

  const hasIpv6Zone = value.includes("%");
  if (hasIpv6Zone) {
    value = value.split("%")[0]!;
  }

  return value.toLowerCase();
}

function detectIpType(ip: string): IpType | null {
  if (ip.includes(".")) {
    return "ipv4";
  }

  if (ip.includes(":")) {
    return "ipv6";
  }

  return null;
}

function parseIPv4(raw: string) {
  const parts = raw.split(".");

  if (parts.length !== 4) {
    return null;
  }

  const numbers = parts.map((part) => Number.parseInt(part, 10));

  if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }

  return numbers;
}

function ipv4ToInt(parts: number[]) {
  return (((((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0) >>> 0);
}

function parseIPv4Range(raw: string): IpRange | null {
  const [ipPart, prefixPart] = raw.split("/");
  const ip = parseIPv4(ipPart);

  if (!ip) {
    return null;
  }

  const ipNum = ipv4ToInt(ip);

  if (prefixPart === undefined) {
    return {
      start: ipNum,
      end: ipNum,
    };
  }

  const mask = Number.parseInt(prefixPart, 10);

  if (!Number.isInteger(mask) || mask < 0 || mask > 32) {
    return null;
  }

  if (mask === 0) {
    return { start: 0, end: 0xffffffff };
  }

  if (mask === 32) {
    return { start: ipNum, end: ipNum };
  }

  const networkMask = (0xffffffff << (32 - mask)) >>> 0;
  const start = (ipNum & networkMask) >>> 0;
  const end = (start | (0xffffffff ^ networkMask)) >>> 0;

  return {
    start,
    end,
  };
}

function parseIPv6(raw: string) {
  if (!raw.includes(":")) {
    return null;
  }

  return raw;
}

function getClientIpFromRequest(request: Request) {
  const xff = request.headers.get("X-Forwarded-For");
  const xRealIp = request.headers.get("X-Real-IP");

  const cfIp = request.headers.get("CF-Connecting-IP");
  const candidates = [
    cfIp,
    xff?.split(",")[0]?.trim(),
    xRealIp,
    request.headers.get("X-Client-IP"),
  ];

  for (const raw of candidates) {
    if (!raw) {
      continue;
    }

    const normalized = normalizeIp(raw);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function isIpMatch(allowed: string, target: string) {
  const normalizedAllowed = normalizeIp(allowed);
  if (!normalizedAllowed || !target) {
    return false;
  }

  const targetType = detectIpType(target);
  const allowedType = detectIpType(normalizedAllowed);

  if (!targetType || !allowedType) {
    return false;
  }

  if (allowedType === "ipv6" || targetType === "ipv6") {
    if (allowedType !== targetType) {
      return false;
    }
    return parseIPv6(normalizedAllowed) === parseIPv6(target);
  }

  const targetRange = parseIPv4Range(normalizedAllowed);
  if (!targetRange) {
    return false;
  }

  const targetIp = parseIPv4(target);
  if (!targetIp) {
    return false;
  }

  const targetValue = ipv4ToInt(targetIp);
  return targetValue >= targetRange.start && targetValue <= targetRange.end;
}

export function checkAutomationIpAccess(env: AppEnv["Bindings"], request: Request): IpCheckResult {
  const configured = (env.AUTOMATION_ALLOWED_IPS ?? "").trim();
  if (configured === "change-me-in-cloudflare-or-dev-vars") {
    return "not_configured";
  }

  if (!configured) {
    return "not_configured";
  }

  const clientIp = getClientIpFromRequest(request);
  if (!clientIp) {
    return "denied";
  }

  const entries = configured
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!entries.length) {
    return "not_configured";
  }

  return entries.some((entry) => isIpMatch(entry, clientIp)) ? "ok" : "denied";
}
