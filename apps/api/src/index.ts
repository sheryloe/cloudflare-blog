import { Hono } from "hono";
import type { Context, Next } from "hono";

import { ConfigurationError } from "./lib/auth";
import { fail, ok } from "./lib/http";
import { renderLocalApiDocs } from "./lib/local-api-docs";
import { MediaUploadError } from "./lib/media";
import { PostValidationError } from "./lib/posts";
import { renderRssXml, renderSitemapXml } from "./lib/public-site";
import { getSiteSettings } from "./lib/site-settings";
import { listCategories, listPublishedPosts } from "./lib/posts";
import publicRoutes from "./routes/public";
import adminRoutes from "./routes/admin";
import bloggerRoutes from "./routes/blogger";
import integrationsRoutes from "./routes/integrations";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

const DEFAULT_ALLOWED_HEADERS = ["Authorization", "Content-Type", "x-automation-key"];
const PLACEHOLDER_PUBLIC_ORIGIN = "https://blog.example.com";
const PLACEHOLDER_ADMIN_ORIGIN = "https://admin.example.com";
const PUBLIC_APP_PREVIEW_HOST_SUFFIXES = ["donggri-world.pages.dev"] as const;
const LOCAL_PUBLIC_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
];
const LOCAL_ADMIN_ORIGINS = ["http://127.0.0.1:5174", "http://localhost:5174"];
const IMMUTABLE_ASSET_PATH_PATTERN = /\.[a-f0-9]{8,}\.[a-z0-9]+$/i;

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

function resolveConfiguredOrigin(value: string | undefined) {
  const firstOrigin = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .find(Boolean);

  return firstOrigin ? normalizeOrigin(firstOrigin) : "";
}

function isLocalHostname(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function isLocalRequest(c: Context<AppEnv>) {
  try {
    return isLocalHostname(new URL(c.req.url).hostname);
  } catch {
    return false;
  }
}

function withLocalDevelopmentOrigins(
  c: Context<AppEnv>,
  allowedOrigins: Set<string>,
  options: {
    includePublicApp: boolean;
    includeAdminApp: boolean;
  },
) {
  if (!isLocalRequest(c)) {
    return allowedOrigins;
  }

  const normalizedOrigins = new Set(allowedOrigins);

  if (options.includePublicApp) {
    for (const origin of LOCAL_PUBLIC_ORIGINS) {
      normalizedOrigins.add(origin);
    }
  }

  if (options.includeAdminApp) {
    for (const origin of LOCAL_ADMIN_ORIGINS) {
      normalizedOrigins.add(origin);
    }
  }

  return normalizedOrigins;
}

function resolvePublicSiteUrl(c: Context<AppEnv>) {
  const configuredOrigin = resolveConfiguredOrigin(c.env.PUBLIC_APP_ORIGIN);

  if (isLocalRequest(c) && configuredOrigin === PLACEHOLDER_PUBLIC_ORIGIN) {
    return LOCAL_PUBLIC_ORIGINS[0];
  }

  return configuredOrigin;
}

function appendVaryHeader(headers: Headers, value: string) {
  const current = headers.get("Vary");

  if (!current) {
    headers.set("Vary", value);
    return;
  }

  const values = current
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!values.includes(value)) {
    headers.set("Vary", [...values, value].join(", "));
  }
}

function isAllowedPublicPreviewOrigin(origin: string) {
  try {
    const url = new URL(origin);

    if (url.protocol !== "https:") {
      return false;
    }

    return PUBLIC_APP_PREVIEW_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

function resolveAllowedOrigin(
  c: Context<AppEnv>,
  allowedOrigins: Set<string>,
  options: {
    allowPublicPreviewOrigin?: boolean;
  },
) {
  const requestOrigin = c.req.header("Origin");

  if (!requestOrigin) {
    return null;
  }

  const normalized = normalizeOrigin(requestOrigin);

  if (allowedOrigins.has(normalized)) {
    return normalized;
  }

  if (options.allowPublicPreviewOrigin && isAllowedPublicPreviewOrigin(normalized)) {
    return normalized;
  }

  return null;
}

function setCorsHeaders(
  headers: Headers,
  origin: string,
  options: {
    allowCredentials: boolean;
    allowMethods: string[];
  },
) {
  appendVaryHeader(headers, "Origin");
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
    allowPublicPreviewOrigin?: boolean;
  },
) {
  return async (c: Context<AppEnv>, next: Next) => {
    const allowedOrigin = resolveAllowedOrigin(c, resolveAllowedOrigins(c), {
      allowPublicPreviewOrigin: options.allowPublicPreviewOrigin,
    });

    if (c.req.method === "OPTIONS") {
      const response = new Response(null, { status: 204 });
      appendVaryHeader(response.headers, "Origin");

      if (allowedOrigin) {
        setCorsHeaders(response.headers, allowedOrigin, options);
      }

      return response;
    }

    await next();
    appendVaryHeader(c.res.headers, "Origin");

    if (allowedOrigin) {
      setCorsHeaders(c.res.headers, allowedOrigin, options);
    }
  };
}

app.use(
  "/api/public/*",
  corsAllowlist(
    (c) =>
      withLocalDevelopmentOrigins(
        c,
        parseAllowedOrigins(c.env.PUBLIC_APP_ORIGIN, c.env.ADMIN_APP_ORIGIN),
        {
          includePublicApp: true,
          includeAdminApp: true,
        },
      ),
    {
      allowCredentials: true,
      allowMethods: ["GET", "POST", "OPTIONS"],
    },
  ),
);

app.use(
  "/api/admin/*",
  corsAllowlist(
    (c) =>
      withLocalDevelopmentOrigins(c, parseAllowedOrigins(c.env.ADMIN_APP_ORIGIN), {
        includePublicApp: false,
        includeAdminApp: true,
      }),
    {
      allowCredentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    },
  ),
);

app.use(
  "/api/blogger/*",
  corsAllowlist(
    (c) =>
      withLocalDevelopmentOrigins(
        c,
        parseAllowedOrigins(c.env.PUBLIC_APP_ORIGIN, c.env.ADMIN_APP_ORIGIN),
        {
          includePublicApp: true,
          includeAdminApp: true,
        },
      ),
    {
      allowCredentials: true,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowPublicPreviewOrigin: true,
    },
  ),
);

app.use(
  "/api/integrations/*",
  corsAllowlist(
    (c) =>
      withLocalDevelopmentOrigins(
        c,
        parseAllowedOrigins(c.env.BLOGGERGENT_ALLOWED_ORIGIN, c.env.ADMIN_APP_ORIGIN),
        {
          includePublicApp: false,
          includeAdminApp: true,
        },
      ),
    {
      allowCredentials: false,
      allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    },
  ),
);

app.get("/health", (c) => ok(c, { status: "ok" }));

app.get("/__api", (c) => {
  if (!isLocalRequest(c)) {
    return fail(c, 404, "NOT_FOUND", "The requested route does not exist.");
  }

  return new Response(renderLocalApiDocs(c), {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
});

app.get("/rss.xml", async (c) => {
  const [posts, siteSettings] = await Promise.all([listPublishedPosts(c.env.DB), getSiteSettings(c.env.DB)]);
  const xml = renderRssXml({
    siteUrl: resolvePublicSiteUrl(c),
    title: siteSettings.branding.siteTitle,
    description: siteSettings.branding.siteDescription,
    posts,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=UTF-8",
      "Cache-Control": "public, max-age=900",
    },
  });
});

app.get("/feed.xml", async (c) => {
  const [posts, siteSettings] = await Promise.all([listPublishedPosts(c.env.DB), getSiteSettings(c.env.DB)]);
  const xml = renderRssXml({
    siteUrl: resolvePublicSiteUrl(c),
    title: siteSettings.branding.siteTitle,
    description: siteSettings.branding.siteDescription,
    posts,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=UTF-8",
      "Cache-Control": "public, max-age=900",
    },
  });
});

app.get("/sitemap.xml", async (c) => {
  const [posts, categories] = await Promise.all([listPublishedPosts(c.env.DB), listCategories(c.env.DB)]);

  const xml = renderSitemapXml({
    siteUrl: resolvePublicSiteUrl(c),
    posts,
    categories,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "public, max-age=900",
    },
  });
});

app.on(["GET", "HEAD"], "/assets/*", async (c) => {
  const path = c.req.path.replace(/^\/assets\//, "").trim();

  if (!path) {
    return fail(c, 404, "ASSET_NOT_FOUND", "The requested asset does not exist.");
  }

  const object = await c.env.ASSETS.get(path);

  if (!object) {
    return fail(c, 404, "ASSET_NOT_FOUND", "The requested asset does not exist.");
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set(
    "Cache-Control",
    IMMUTABLE_ASSET_PATH_PATTERN.test(path)
      ? "public, max-age=31536000, immutable"
      : "public, max-age=86400, stale-while-revalidate=604800",
  );

  return new Response(c.req.method === "HEAD" ? null : object.body, {
    headers,
  });
});

app.route("/api/public", publicRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/blogger/v3", bloggerRoutes);
app.route("/api/integrations", integrationsRoutes);

app.notFound((c) => fail(c, 404, "NOT_FOUND", "The requested route does not exist."));

app.onError((error, c) => {
  if (error instanceof ConfigurationError) {
    return fail(c, 500, "CONFIGURATION_ERROR", error.message);
  }

  if (error instanceof MediaUploadError) {
    return fail(c, error.status, error.code, error.message);
  }

  if (error instanceof PostValidationError) {
    return fail(c, error.status, error.code, error.message);
  }

  console.error(error);
  return fail(c, 500, "INTERNAL_ERROR", "An unexpected server error occurred.");
});

export default app;
