import { Hono } from "hono";
import type { Context, Next } from "hono";

import { ConfigurationError } from "./lib/auth";
import { fail, ok } from "./lib/http";
import publicRoutes from "./routes/public";
import adminRoutes from "./routes/admin";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

const DEFAULT_ALLOWED_HEADERS = ["Authorization", "Content-Type"];

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function parseAllowedOrigins(...values: Array<string | undefined>) {
  return new Set(
    values
      .flatMap((value) => (value ?? "").split(","))
      .map((value) => value.trim())
      .filter(Boolean)
      .map(normalizeOrigin),
  );
}

function getAllowedOrigin(c: Context<AppEnv>, allowedOrigins: Set<string>) {
  const requestOrigin = c.req.header("Origin");

  if (!requestOrigin) {
    return null;
  }

  const normalized = normalizeOrigin(requestOrigin);
  return allowedOrigins.has(normalized) ? normalized : null;
}

function setCorsHeaders(
  headers: Headers,
  origin: string,
  options: {
    allowCredentials: boolean;
    allowMethods: string[];
  },
) {
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Headers", DEFAULT_ALLOWED_HEADERS.join(", "));
  headers.set("Access-Control-Allow-Methods", options.allowMethods.join(", "));

  if (options.allowCredentials) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }
}

function corsAllowlist(
  resolveAllowedOrigins: (c: Context<AppEnv>) => Set<string>,
  options: {
    allowCredentials: boolean;
    allowMethods: string[];
  },
) {
  return async (c: Context<AppEnv>, next: Next) => {
    const allowedOrigin = getAllowedOrigin(c, resolveAllowedOrigins(c));

    if (c.req.method === "OPTIONS") {
      const response = new Response(null, { status: 204 });

      if (allowedOrigin) {
        setCorsHeaders(response.headers, allowedOrigin, options);
      }

      return response;
    }

    await next();

    if (allowedOrigin) {
      setCorsHeaders(c.res.headers, allowedOrigin, options);
    }
  };
}

app.use(
  "/api/public/*",
  corsAllowlist(
    (c) => parseAllowedOrigins(c.env.PUBLIC_APP_ORIGIN, c.env.ADMIN_APP_ORIGIN),
    {
      allowCredentials: true,
      allowMethods: ["GET", "OPTIONS"],
    },
  ),
);

app.use(
  "/api/admin/*",
  corsAllowlist(
    (c) => parseAllowedOrigins(c.env.ADMIN_APP_ORIGIN),
    {
      allowCredentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    },
  ),
);

app.get("/health", (c) => ok(c, { status: "ok" }));
app.route("/api/public", publicRoutes);
app.route("/api/admin", adminRoutes);

app.notFound((c) => fail(c, 404, "NOT_FOUND", "The requested route does not exist."));

app.onError((error, c) => {
  if (error instanceof ConfigurationError) {
    return fail(c, 500, "CONFIGURATION_ERROR", error.message);
  }

  console.error(error);
  return fail(c, 500, "INTERNAL_ERROR", "An unexpected server error occurred.");
});

export default app;
