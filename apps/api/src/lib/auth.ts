import type { AdminSession, LoginInput } from "@donggeuri/shared";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";

import type { AppEnv, WorkerBindings } from "../types";

const SESSION_COOKIE_NAME = "donggeuri_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

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
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH) {
    return false;
  }

  if (credentials.email.trim().toLowerCase() !== env.ADMIN_EMAIL.trim().toLowerCase()) {
    return false;
  }

  const candidate = await sha256Hex(credentials.password);
  const stored = env.ADMIN_PASSWORD_HASH.trim();
  return stored === candidate || stored === `sha256:${candidate}` || stored === credentials.password;
}

export async function getAdminSession(c: Context<AppEnv>): Promise<AdminSession> {
  const token = getCookie(c, SESSION_COOKIE_NAME);

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
  const token = await createSessionToken(email, c.env.JWT_SECRET);
  const secure = new URL(c.req.url).protocol === "https:";

  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearAdminSession(c: Context<AppEnv>) {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
  });
}
