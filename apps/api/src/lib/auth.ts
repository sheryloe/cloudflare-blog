import type { AdminSession, LoginInput } from "@cloudflare-blog/shared";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";

import type { AppEnv, WorkerBindings } from "../types";

const SESSION_COOKIE_NAME = "donggeuri_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const LOCAL_DEV_ADMIN_EMAIL = "admin@example.com";
const LOCAL_DEV_ADMIN_PASSWORD_HASH =
  "sha256:5c06eb3d5a05a19f49476d694ca81a36344660e9d5b98e3d6a6630f31c2422e7";
const LOCAL_DEV_JWT_SECRET = "local-dev-secret";

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

interface SessionPayload {
  email: string;
  exp: number;
}

interface ResolvedAdminConfig {
  adminEmail?: string;
  adminPasswordHash?: string;
  jwtSecret?: string;
}

function encodeBase64Url(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return atob(`${normalized}${padding}`);
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(value: string, secret: string) {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return encodeBase64Url(String.fromCharCode(...new Uint8Array(signature)));
}

function isLocalRequestUrl(requestUrl?: string) {
  if (!requestUrl) {
    return false;
  }

  try {
    const { hostname } = new URL(requestUrl);
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

function resolveAdminConfig(env: WorkerBindings, requestUrl?: string): ResolvedAdminConfig {
  const localRequest = isLocalRequestUrl(requestUrl);
  const adminEmail = env.ADMIN_EMAIL?.trim() || (localRequest ? LOCAL_DEV_ADMIN_EMAIL : undefined);
  const adminPasswordHash =
    env.ADMIN_PASSWORD_HASH?.trim() || (localRequest ? LOCAL_DEV_ADMIN_PASSWORD_HASH : undefined);
  const jwtSecret = env.JWT_SECRET?.trim() || (localRequest ? LOCAL_DEV_JWT_SECRET : undefined);

  return {
    adminEmail,
    adminPasswordHash,
    jwtSecret,
  };
}

function requireJwtSecret(secret: string | undefined) {
  const normalized = secret?.trim();

  if (!normalized) {
    throw new ConfigurationError("JWT_SECRET must be configured before admin login is enabled.");
  }

  return normalized;
}

function normalizePasswordHash(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  if (/^sha256:[0-9a-f]{64}$/i.test(normalized)) {
    return normalized.slice("sha256:".length).toLowerCase();
  }

  if (/^[0-9a-f]{64}$/i.test(normalized)) {
    return normalized.toLowerCase();
  }

  return null;
}

async function createSessionToken(email: string, secret: string) {
  const payload = encodeBase64Url(
    JSON.stringify({
      email,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    } satisfies SessionPayload),
  );
  const signature = await sign(payload, secret);
  return `${payload}.${signature}`;
}

function getBearerToken(c: Context<AppEnv>) {
  const authorization = c.req.header("Authorization")?.trim();

  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || null;
}

async function verifySessionToken(token: string, secret: string): Promise<SessionPayload | null> {
  const [payloadPart, signaturePart] = token.split(".");

  if (!payloadPart || !signaturePart) {
    return null;
  }

  const expected = await sign(payloadPart, secret);

  if (expected !== signaturePart) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadPart)) as SessionPayload;

    if (!payload.email || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function verifyAdminCredentials(
  credentials: LoginInput,
  env: WorkerBindings,
  requestUrl?: string,
): Promise<boolean> {
  const config = resolveAdminConfig(env, requestUrl);
  requireJwtSecret(config.jwtSecret);

  if (!config.adminEmail || !config.adminPasswordHash) {
    return false;
  }

  if (credentials.email.trim().toLowerCase() !== config.adminEmail.trim().toLowerCase()) {
    return false;
  }

  const candidate = await sha256Hex(credentials.password);
  const stored = normalizePasswordHash(config.adminPasswordHash);
  return stored === candidate;
}

export async function getAdminSession(c: Context<AppEnv>): Promise<AdminSession> {
  const token = getBearerToken(c) ?? getCookie(c, SESSION_COOKIE_NAME);
  const config = resolveAdminConfig(c.env, c.req.url);

  if (!token || !config.jwtSecret) {
    return {
      authenticated: false,
      user: null,
    };
  }

  const payload = await verifySessionToken(token, config.jwtSecret);

  if (!payload) {
    return {
      authenticated: false,
      user: null,
    };
  }

  return {
    authenticated: true,
    user: {
      email: payload.email,
    },
  };
}

export async function createAdminSession(c: Context<AppEnv>, email: string) {
  const config = resolveAdminConfig(c.env, c.req.url);
  const token = await createSessionToken(email, requireJwtSecret(config.jwtSecret));
  const secure = new URL(c.req.url).protocol === "https:";

  // Keep the cookie for same-site custom-domain deployments, but also return
  // the token so the Pages admin app can use Authorization headers on pages.dev.
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return token;
}

export function clearAdminSession(c: Context<AppEnv>) {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
  });
}
