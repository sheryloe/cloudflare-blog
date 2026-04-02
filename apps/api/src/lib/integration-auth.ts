import type { Context } from "hono";

import { fail } from "./http";
import type { AppEnv } from "../types";

function getConfiguredToken(env: AppEnv["Bindings"]) {
  const configured = (env.BLOGGERGENT_M2M_TOKEN ?? "").trim();

  if (!configured || configured === "change-me-for-bloggergent") {
    return null;
  }

  return configured;
}

function getBearerToken(c: Context<AppEnv>) {
  const authorization = c.req.header("Authorization")?.trim();

  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || null;
}

function isAllowedOrigin(c: Context<AppEnv>) {
  const allowedOrigin = (c.env.BLOGGERGENT_ALLOWED_ORIGIN ?? "").trim();

  if (!allowedOrigin) {
    return true;
  }

  const requestOrigin = c.req.header("Origin")?.trim();
  if (!requestOrigin) {
    return true;
  }

  return requestOrigin === allowedOrigin;
}

export function requireIntegrationAuth(c: Context<AppEnv>) {
  const configuredToken = getConfiguredToken(c.env);

  if (!configuredToken) {
    return fail(
      c,
      503,
      "BLOGGERGENT_M2M_NOT_CONFIGURED",
      "BLOGGERGENT_M2M_TOKEN must be configured before integration routes can be used.",
    );
  }

  if (!isAllowedOrigin(c)) {
    return fail(c, 403, "INTEGRATION_ORIGIN_FORBIDDEN", "Origin is not allowed for integration routes.");
  }

  const providedToken = getBearerToken(c);
  if (!providedToken) {
    return fail(c, 401, "INTEGRATION_UNAUTHORIZED", "Missing Bearer token.");
  }

  if (providedToken !== configuredToken) {
    return fail(c, 403, "INTEGRATION_FORBIDDEN", "Invalid BloggerGent integration token.");
  }

  return null;
}
