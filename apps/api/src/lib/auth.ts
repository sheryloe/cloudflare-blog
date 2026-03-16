import type { AdminSession, LoginInput } from "@donggeuri/shared";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";

import type { AppEnv, WorkerBindings } from "../types";

const SESSION_COOKIE_NAME = "donggeuri_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

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
): Promise<boolean> {
  requireJwtSecret(env.JWT_SECRET);

  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH) {
    return false;
  }

  if (credentials.email.trim().toLowerCase() !== env.ADMIN_EMAIL.trim().toLowerCase()) {
    return false;
  }

  const candidate = await sha256Hex(credentials.password);
  const stored = normalizePasswordHash(env.ADMIN_PASSWORD_HASH);
  return stored === candidate;
}

export async function getAdminSession(c: Context<AppEnv>): Promise<AdminSession> {
  const token = getBearerToken(c) ?? getCookie(c, SESSION_COOKIE_NAME);

  if (!token || !c.env.JWT_SECRET) {
    return {
      authenticated: false,
      user: null,
    };
  }

  const payload = await verifySessionToken(token, c.env.JWT_SECRET);

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
  const token = await createSessionToken(email, requireJwtSecret(c.env.JWT_SECRET));
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
