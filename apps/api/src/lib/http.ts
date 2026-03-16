import type { ApiFailure, ApiSuccess } from "@donggeuri/shared";
import type { Context, Next } from "hono";
import { z } from "zod";

import { getAdminSession } from "./auth";
import type { AppEnv } from "../types";

export function ok<T>(c: Context<AppEnv>, data: T, status = 200) {
  const body: ApiSuccess<T> = {
    success: true,
    data,
  };

  return c.json(body, { status: status as never });
}

export function fail(
  c: Context<AppEnv>,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiFailure = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };

  return c.json(body, { status: status as never });
}

export async function parseJson<T>(
  c: Context<AppEnv>,
  schema: z.ZodType<T>,
): Promise<{ data: T } | { response: Response }> {
  const payload = await c.req.json().catch(() => undefined);
  const result = schema.safeParse(payload);

  if (!result.success) {
    return {
      response: fail(c, 400, "VALIDATION_ERROR", "Invalid request body.", result.error.flatten()),
    };
  }

  return { data: result.data };
}

export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  const session = await getAdminSession(c);

  if (!session.authenticated) {
    return fail(c, 401, "UNAUTHORIZED", "Missing or invalid admin session.");
  }

  await next();
}
