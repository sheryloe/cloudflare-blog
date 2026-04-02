import { type Context, Hono } from "hono";
import { z } from "zod";

import type {
  BloggerCompatListResponse,
  BloggerCompatPostInput,
  CreatePostInput,
  UpsertPostBySlugResult,
} from "@cloudflare-blog/shared";
import type { Post } from "@cloudflare-blog/shared";

import { fail, ok, parseJson } from "../lib/http";
import { consumeRateLimit } from "../lib/rate-limit";
import { createPost, getAdminPostById, listAdminPosts, listPublishedPosts, slugify, updatePost } from "../lib/posts";
import { listCategoriesForAdmin, listTagsForAdmin, resolveCategoryIdentifier } from "../lib/taxonomies";
import { checkAutomationIpAccess } from "../lib/automation-security";
import { getAdminSession } from "../lib/auth";
import type { AppEnv } from "../types";

type BlogScope = "self" | "dongriarchive";

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const FALLBACK_PUBLIC_ORIGIN = "https://example.com";
const BLOG_SCOPES = new Set<BlogScope>(["self", "dongriarchive"]);

const postCreateInputSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  summary: z.string().trim().nullable().optional(),
  labels: z.array(z.string().trim().min(1)).max(20).optional(),
  tagNames: z.array(z.string().trim().min(1)).max(20).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  isDraft: z.boolean().optional(),
  publishedAt: z.string().trim().nullable().optional(),
  category: z.string().trim().nullable().optional(),
  categoryId: z.string().trim().nullable().optional(),
});

const bloggerRoutes = new Hono<AppEnv>();

function parseListLimit(raw: string | undefined) {
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIST_LIMIT, Math.floor(parsed)));
}

function parsePageOffset(raw: string | undefined) {
  const parsed = Number.parseInt(raw ?? "0", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function parseQueryList(raw: string | undefined) {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeTags(values: string[] | undefined) {
  const normalized = new Map<string, string>();

  for (const value of values ?? []) {
    const trimmed = value.trim();

    if (!trimmed) {
      continue;
    }

    const lower = trimmed.toLowerCase();
    if (!normalized.has(lower)) {
      normalized.set(lower, trimmed);
    }
  }

  return [...normalized.values()];
}

function getConfiguredAutomationKey(env: AppEnv["Bindings"]) {
  const configured = (env.AUTOMATION_API_KEY ?? "").trim();

  if (!configured) {
    return null;
  }

  if (configured === "change-me-in-cloudflare-or-dev-vars") {
    return "placeholder";
  }

  return configured;
}

function resolvePublicOrigin(env: AppEnv["Bindings"]) {
  const origin = (env.PUBLIC_APP_ORIGIN ?? "").split(",")[0]?.trim();

  if (!origin) {
    return FALLBACK_PUBLIC_ORIGIN;
  }

  try {
    return new URL(origin).origin;
  } catch {
    return FALLBACK_PUBLIC_ORIGIN;
  }
}

function isAuthorizedByAutomationKey(env: AppEnv["Bindings"], key: string | undefined) {
  const configuredKey = getConfiguredAutomationKey(env);

  if (!configuredKey || configuredKey === "placeholder") {
    return false;
  }

  return configuredKey === (key ?? "").trim();
}

async function requireBloggerAuth(c: Context<AppEnv>) {
  const configuredKey = getConfiguredAutomationKey(c.env);
  const providedKey = c.req.header("x-automation-key");

  if (configuredKey === null) {
    return fail(c, 503, "AUTOMATION_NOT_CONFIGURED", "Automation API key is not configured on this environment.");
  }

  if (configuredKey === "placeholder") {
    return fail(
      c,
      503,
      "AUTOMATION_NOT_CONFIGURED",
      "Set AUTOMATION_API_KEY in environment variables.",
    );
  }

  if (providedKey) {
    const ipCheck = checkAutomationIpAccess(c.env, c.req.raw);

    if (ipCheck === "not_configured") {
      return fail(
        c,
        503,
        "AUTOMATION_IP_NOT_CONFIGURED",
        "Set AUTOMATION_ALLOWED_IPS in environment variables.",
      );
    }

    if (ipCheck === "denied") {
      return fail(
        c,
        403,
        "AUTOMATION_IP_FORBIDDEN",
        "Caller IP is not allowed for automation requests.",
      );
    }
  }

  if (providedKey && isAuthorizedByAutomationKey(c.env, providedKey)) {
    return null;
  }

  const session = await getAdminSession(c);
  if (session.authenticated) {
    return null;
  }

  if (providedKey) {
    return fail(c, 403, "AUTOMATION_FORBIDDEN", "Invalid automation API key.");
  }

  return fail(c, 401, "UNAUTHORIZED", "Missing or invalid admin session.");
}

function resolveStatusFilter(raw: string | undefined) {
  if (raw === "all" || raw === "published" || raw === "draft") {
    return raw;
  }

  return "published";
}

async function hydratePosts(db: D1Database, summaries: { id: string }[]) {
  const hydrated = await Promise.all(summaries.map((summary) => getAdminPostById(db, summary.id)));
  return hydrated.filter((post): post is Post => post !== null);
}

function buildItem(env: AppEnv["Bindings"], base: string, blogId: string, post: Post) {
  return {
    kind: "blogger#post" as const,
    id: post.id,
    title: post.title,
    content: post.content,
    summary: post.excerpt ?? null,
    description: post.excerpt ?? null,
    labels: post.tags.map((tag) => tag.name),
    status: post.status,
    published: post.publishedAt ?? null,
    updated: post.updatedAt,
    url: `${resolvePublicOrigin(env)}/ko/post/${post.slug}`,
    selfLink: `${base}/api/blogger/v3/blogs/${blogId}/posts/${post.id}`,
  };
}

function buildPostFromInput(data: BloggerCompatPostInput, hasExistingPost: boolean) {
  const excerpt =
    data.description !== undefined || data.summary !== undefined ? data.description?.trim() || data.summary?.trim() || null : undefined;

  const hasStatusInput = data.status !== undefined || data.isDraft !== undefined;
  const status = (() => {
    if (data.isDraft === true) {
      return "draft" as const;
    }

    if (data.isDraft === false) {
      return "published" as const;
    }

    if (!hasStatusInput) {
      return hasExistingPost ? undefined : "published";
    }

    return data.status;
  })();

  const hasTagsInput = data.labels !== undefined || data.tagNames !== undefined;
  const hasCategoryInput = data.categoryId !== undefined || data.category !== undefined;
  const hasPublishedAtInput = data.publishedAt !== undefined;

  return {
    title: data.title,
    slug: data.slug?.trim(),
    content: data.content,
    excerpt,
    tagNames: hasTagsInput ? normalizeTags(data.labels ?? data.tagNames) : undefined,
    status,
    publishedAt: hasPublishedAtInput ? data.publishedAt : undefined,
    hasTagsInput,
    hasCategoryInput,
  };
}

bloggerRoutes.get("/blogs/:blogId/posts", async (c) => {
  if (!BLOG_SCOPES.has(c.req.param("blogId") as BlogScope)) {
    return fail(c, 400, "INVALID_BLOG_ID", "Unsupported blog id.");
  }

  const authResult = await requireBloggerAuth(c);

  if (authResult instanceof Response) {
    return authResult;
  }

  const rate = consumeRateLimit({
    request: c.req.raw,
    scope: "blogger-post-list",
    limit: 120,
    windowMs: 60_000,
    subject: c.req.header("x-automation-key") ?? `ip:${c.req.header("CF-Connecting-IP") ?? "unknown"}`,
  });

  if (!rate.allowed) {
    return fail(c, 429, "RATE_LIMITED", "Too many list requests. Please retry soon.");
  }

  const limit = parseListLimit(c.req.query("maxResults"));
  const pageOffset = parsePageOffset(c.req.query("pageToken"));
  const status = resolveStatusFilter(c.req.query("status")?.trim());
  const query = c.req.query("q")?.trim().toLowerCase() ?? "";
  const labels = normalizeTags(parseQueryList(c.req.query("labels")));
  const labelSet = new Set(labels.map((item) => item.toLowerCase()));

  let summaries =
    status === "published" ? await listPublishedPosts(c.env.DB) : await listAdminPosts(c.env.DB);

  if (status === "draft") {
    summaries = summaries.filter((post) => post.status === "draft");
  }

  let hydrated = await hydratePosts(c.env.DB, summaries);

  if (query) {
    hydrated = hydrated.filter((post) => {
      const haystack = [
        post.title,
        post.excerpt ?? "",
        post.content,
        post.category?.name ?? "",
        post.tags.map((tag) => tag.name).join(" "),
      ].join(" ").toLowerCase();

      return haystack.includes(query);
    });
  }

  if (labels.length > 0) {
    hydrated = hydrated.filter((post) =>
      post.tags.some((tag) => labelSet.has(tag.name.toLowerCase()) || labelSet.has(tag.slug.toLowerCase())),
    );
  }

  const base = new URL(c.req.url).origin;
  const items = hydrated
    .slice(pageOffset, pageOffset + limit)
    .map((post) => buildItem(c.env, base, c.req.param("blogId"), post));

  const response: BloggerCompatListResponse = {
    kind: "blogger#postList",
    items,
    nextPageToken: pageOffset + limit < hydrated.length ? String(pageOffset + limit) : undefined,
  };

  return ok(c, response);
});

bloggerRoutes.post("/blogs/:blogId/posts", async (c) => {
  if (!BLOG_SCOPES.has(c.req.param("blogId") as BlogScope)) {
    return fail(c, 400, "INVALID_BLOG_ID", "Unsupported blog id.");
  }

  const authResult = await requireBloggerAuth(c);
  if (authResult instanceof Response) {
    return authResult;
  }

  const rate = consumeRateLimit({
    request: c.req.raw,
    scope: "blogger-post-upsert",
    limit: 20,
    windowMs: 60_000,
    subject: c.req.header("x-automation-key") ?? `ip:${c.req.header("CF-Connecting-IP") ?? "unknown"}`,
  });

  if (!rate.allowed) {
    return fail(c, 429, "RATE_LIMITED", "Too many write requests. Please retry soon.");
  }

  const parsed = await parseJson<BloggerCompatPostInput>(c, postCreateInputSchema);
  if ("response" in parsed) {
    return parsed.response;
  }

  const body = parsed.data;
  const resolvedSlug = slugify((body.slug?.trim() ?? body.title));
  const existing = await c.env.DB
    .prepare("SELECT id FROM posts WHERE slug = ?1 LIMIT 1")
    .bind(resolvedSlug)
    .first<{ id: string }>();
  const payloadBase = buildPostFromInput(body, Boolean(existing?.id));

  if (!resolvedSlug) {
    return fail(c, 400, "INVALID_POST_SLUG", "A valid slug could not be generated.");
  }

  const categoryResolveInput = (body.categoryId ?? body.category)?.trim();
  const resolvedCategoryId = categoryResolveInput
    ? await resolveCategoryIdentifier(c.env.DB, categoryResolveInput)
    : null;

  if (categoryResolveInput && !resolvedCategoryId) {
    return fail(c, 404, "CATEGORY_NOT_FOUND", "Category could not be resolved.");
  }

  const payload: CreatePostInput = {
    title: payloadBase.title,
    slug: resolvedSlug,
    content: payloadBase.content,
    excerpt: payloadBase.excerpt,
    status: payloadBase.status,
    publishedAt: payloadBase.publishedAt,
  };

  if (payloadBase.hasCategoryInput) {
    payload.categoryId = resolvedCategoryId;
  }

  if (payloadBase.hasTagsInput) {
    payload.tagNames = payloadBase.tagNames;
  }

  let result: Awaited<ReturnType<typeof createPost>>;
  if (existing?.id) {
    result = await updatePost(c.env.DB, existing.id, payload);
  } else {
    result = await createPost(c.env.DB, payload);
  }

  if (!result) {
    return fail(c, 500, "POST_SAVE_FAILED", "Post could not be created or updated.");
  }

  const response: UpsertPostBySlugResult = {
    operation: existing?.id ? "updated" : "created",
    post: result,
  };

  return ok(c, response, existing?.id ? 200 : 201);
});

bloggerRoutes.get("/blogs/:blogId/labels", async (c) => {
  if (!BLOG_SCOPES.has(c.req.param("blogId") as BlogScope)) {
    return fail(c, 400, "INVALID_BLOG_ID", "Unsupported blog id.");
  }

  const authResult = await requireBloggerAuth(c);
  if (authResult instanceof Response) {
    return authResult;
  }

  const rate = consumeRateLimit({
    request: c.req.raw,
    scope: "blogger-labels",
    limit: 120,
    windowMs: 60_000,
    subject: c.req.header("x-automation-key") ?? `ip:${c.req.header("CF-Connecting-IP") ?? "unknown"}`,
  });

  if (!rate.allowed) {
    return fail(c, 429, "RATE_LIMITED", "Too many label requests. Please retry soon.");
  }

  const tags = await listTagsForAdmin(c.env.DB);
  const items = [...new Set(tags.map((tag) => tag.name))];

  return ok(c, {
    kind: "blogger#labels" as const,
    items,
  });
});

bloggerRoutes.get("/blogs/:blogId/categories", async (c) => {
  if (!BLOG_SCOPES.has(c.req.param("blogId") as BlogScope)) {
    return fail(c, 400, "INVALID_BLOG_ID", "Unsupported blog id.");
  }

  const authResult = await requireBloggerAuth(c);
  if (authResult instanceof Response) {
    return authResult;
  }

  const rate = consumeRateLimit({
    request: c.req.raw,
    scope: "blogger-categories",
    limit: 120,
    windowMs: 60_000,
    subject: c.req.header("x-automation-key") ?? `ip:${c.req.header("CF-Connecting-IP") ?? "unknown"}`,
  });

  if (!rate.allowed) {
    return fail(c, 429, "RATE_LIMITED", "Too many category requests. Please retry soon.");
  }

  const categories = await listCategoriesForAdmin(c.env.DB);
  return ok(c, {
    kind: "blogger#categories" as const,
    items: categories,
  });
});

export default bloggerRoutes;
