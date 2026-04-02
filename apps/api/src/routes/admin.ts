import { Hono } from "hono";
import { z } from "zod";

import type {
  LoginInput,
  SiteSettings,
  TaxonomyInput,
  UpsertPostBySlugInput,
  UpsertPostBySlugResult,
} from "@cloudflare-blog/shared";

import { clearAdminSession, createAdminSession, getAdminSession, verifyAdminCredentials } from "../lib/auth";
import { fail, ok, parseJson, requireAdmin } from "../lib/http";
import { previewExternalLink } from "../lib/link-preview";
import { MediaUploadError, listMediaAssets, storeMediaAsset, updateMediaAssetMeta } from "../lib/media";
import { createPost, deletePost, getAdminPostById, listAdminPosts, slugify, updatePost } from "../lib/posts";
import { consumeRateLimit } from "../lib/rate-limit";
import { checkAutomationIpAccess } from "../lib/automation-security";
import { updateSiteSettings, getSiteSettings } from "../lib/site-settings";
import {
  createCategory,
  createTag,
  deleteCategory,
  deleteTag,
  listCategoriesForAdmin,
  listTagsForAdmin,
  updateCategory,
  updateTag,
} from "../lib/taxonomies";
import type { AppEnv } from "../types";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const relatedLinkSchema = z.object({
  url: z.string().trim().url(),
  title: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  image: z.string().trim().url().nullable().optional(),
  siteName: z.string().trim().nullable().optional(),
});

const postInputSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().trim().nullable().optional(),
  slug: z.string().trim().min(1).optional(),
  excerpt: z.string().trim().nullable().optional(),
  seoTitle: z.string().trim().nullable().optional(),
  seoDescription: z.string().trim().nullable().optional(),
  content: z.string().min(1),
  categoryId: z.string().trim().nullable().optional(),
  tagIds: z.array(z.string().trim().min(1)).optional(),
  tagNames: z.array(z.string().trim().min(1)).max(10).optional(),
  coverImage: z.string().trim().nullable().optional(),
  coverAlt: z.string().trim().nullable().optional(),
  youtubeUrl: z.string().trim().nullable().optional(),
  relatedLinks: z.array(relatedLinkSchema).max(5).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  publishedAt: z.string().trim().nullable().optional(),
});

const postUpdateSchema = postInputSchema.partial();
const upsertPostBySlugSchema = postInputSchema.extend({
  slug: z.string().trim().min(1),
});
const mediaUpdateSchema = z.object({
  altText: z.string().trim().nullable().optional(),
});
const linkPreviewInputSchema = z.object({
  url: z.string().trim().url(),
});

const taxonomySchema = z.object({
  name: z.string().min(1),
  slug: z.string().trim().optional(),
  description: z.string().trim().nullable().optional(),
  seoTitle: z.string().trim().nullable().optional(),
  seoDescription: z.string().trim().nullable().optional(),
  parentId: z.string().trim().nullable().optional(),
});
const taxonomyUpdateSchema = taxonomySchema
  .partial()
  .refine((value) =>
    Boolean(
      value.name ||
        value.slug ||
        value.description !== undefined ||
        value.seoTitle !== undefined ||
        value.seoDescription !== undefined ||
        value.parentId !== undefined,
    ),
  );
const siteSettingsSchema = z.object({
  branding: z.object({
    siteTitle: z.string().min(1),
    siteAltName: z.string().min(1),
    siteAuthor: z.string().min(1),
    siteTagline: z.string().min(1),
    siteDescription: z.string().min(1),
  }),
  sidebar: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
  }),
  home: z.object({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    featuredTitle: z.string().min(1),
    featuredDescription: z.string().min(1),
    latestTitle: z.string().min(1),
    latestDescription: z.string().min(1),
  }),
  search: z.object({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    placeholder: z.string().min(1),
  }),
  about: z.object({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    featureTitle: z.string().min(1),
    featureDescription: z.string().min(1),
    categoriesTitle: z.string().min(1),
    categoriesDescription: z.string().min(1),
  }),
});

const adminRoutes = new Hono<AppEnv>();

type UpsertBySlugOutcome =
  | { data: UpsertPostBySlugResult }
  | { error: { status: number; code: string; message: string } };

async function runUpsertBySlug(
  c: { env: AppEnv["Bindings"] },
  input: UpsertPostBySlugInput,
): Promise<UpsertBySlugOutcome> {
  const normalizedSlug = slugify(input.slug);

  if (!normalizedSlug) {
    return { error: { status: 400 as const, code: "INVALID_POST_SLUG", message: "A post slug could not be generated." } };
  }

  const payload: UpsertPostBySlugInput = {
    ...input,
    slug: normalizedSlug,
  };

  const existing = await c.env.DB
    .prepare("SELECT id FROM posts WHERE slug = ?1 LIMIT 1")
    .bind(normalizedSlug)
    .first<{ id: string }>();

  if (existing?.id) {
    const post = await updatePost(c.env.DB, existing.id, payload);

    if (!post) {
      return { error: { status: 404 as const, code: "POST_NOT_FOUND", message: "No post matched the requested slug." } };
    }

    return { data: { operation: "updated" as const, post } };
  }

  const post = await createPost(c.env.DB, payload);

  if (!post) {
    return { error: { status: 500 as const, code: "POST_CREATE_FAILED", message: "Post was created but could not be loaded." } };
  }

  return { data: { operation: "created" as const, post } };
}

function getConfiguredAutomationKey(env: AppEnv["Bindings"]) {
  const configured = (env.AUTOMATION_API_KEY ?? "").trim();
  if (!configured || configured === "change-me-in-cloudflare-or-dev-vars") {
    return null;
  }

  return configured;
}

adminRoutes.post("/login", async (c) => {
  const limit = consumeRateLimit({
    request: c.req.raw,
    scope: "admin-login",
    limit: 20,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return fail(c, 429, "RATE_LIMITED", "Too many login attempts. Please wait and retry.");
  }

  const parsed = await parseJson<LoginInput>(c, loginSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const valid = await verifyAdminCredentials(parsed.data, c.env, c.req.url);

  if (!valid) {
    return fail(c, 401, "INVALID_CREDENTIALS", "The provided login credentials were not accepted.");
  }

  const email = parsed.data.email.trim().toLowerCase();
  const token = await createAdminSession(c, email);
  return ok(c, {
    session: {
      authenticated: true,
      user: {
        email,
      },
    },
    token,
  });
});

adminRoutes.post("/logout", async (c) => {
  clearAdminSession(c);
  return ok(c, { loggedOut: true });
});

adminRoutes.get("/session", async (c) => {
  return ok(c, await getAdminSession(c));
});

adminRoutes.post("/posts/upsert-by-slug", async (c) => {
  const configuredAutomationKey = getConfiguredAutomationKey(c.env);

  if (!configuredAutomationKey) {
    return fail(
      c,
      503,
      "AUTOMATION_NOT_CONFIGURED",
      "Automation API key is not configured on this environment.",
    );
  }

  const providedAutomationKey = c.req.header("x-automation-key")?.trim();

  if (providedAutomationKey) {
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

  if (!providedAutomationKey) {
    return fail(c, 401, "AUTOMATION_UNAUTHORIZED", "Missing x-automation-key header.");
  }

  if (providedAutomationKey !== configuredAutomationKey) {
    return fail(c, 403, "AUTOMATION_FORBIDDEN", "Invalid automation API key.");
  }

  const parsed = await parseJson<UpsertPostBySlugInput>(c, upsertPostBySlugSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const result = await runUpsertBySlug(c, parsed.data);

  if ("error" in result) {
    return fail(c, result.error.status, result.error.code, result.error.message);
  }

  return ok<UpsertPostBySlugResult>(c, result.data, result.data.operation === "created" ? 201 : 200);
});

adminRoutes.use("*", requireAdmin);

adminRoutes.post("/posts/upsert-by-slug/manual", async (c) => {
  const parsed = await parseJson<UpsertPostBySlugInput>(c, upsertPostBySlugSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const result = await runUpsertBySlug(c, parsed.data);

  if ("error" in result) {
    return fail(c, result.error.status, result.error.code, result.error.message);
  }

  return ok<UpsertPostBySlugResult>(c, result.data, result.data.operation === "created" ? 201 : 200);
});

adminRoutes.get("/site-settings", async (c) => {
  return ok(c, await getSiteSettings(c.env.DB));
});

adminRoutes.put("/site-settings", async (c) => {
  const parsed = await parseJson<SiteSettings>(c, siteSettingsSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  return ok(c, await updateSiteSettings(c.env.DB, parsed.data));
});

adminRoutes.post("/link-preview", async (c) => {
  const parsed = await parseJson(c, linkPreviewInputSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  return ok(c, await previewExternalLink(parsed.data.url));
});

adminRoutes.get("/posts", async (c) => {
  return ok(c, await listAdminPosts(c.env.DB));
});

adminRoutes.get("/posts/:id", async (c) => {
  const post = await getAdminPostById(c.env.DB, c.req.param("id"));

  if (!post) {
    return fail(c, 404, "POST_NOT_FOUND", "No post matched the requested id.");
  }

  return ok(c, post);
});

adminRoutes.post("/posts", async (c) => {
  const parsed = await parseJson(c, postInputSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const post = await createPost(c.env.DB, parsed.data);
  return ok(c, post, 201);
});

adminRoutes.put("/posts/:id", async (c) => {
  const parsed = await parseJson(c, postUpdateSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const post = await updatePost(c.env.DB, c.req.param("id"), parsed.data);

  if (!post) {
    return fail(c, 404, "POST_NOT_FOUND", "No post matched the requested id.");
  }

  return ok(c, post);
});

adminRoutes.delete("/posts/:id", async (c) => {
  const deleted = await deletePost(c.env.DB, c.req.param("id"));

  if (!deleted) {
    return fail(c, 404, "POST_NOT_FOUND", "No post matched the requested id.");
  }

  return ok(c, { id: c.req.param("id"), deleted: true });
});

adminRoutes.get("/categories", async (c) => {
  return ok(c, await listCategoriesForAdmin(c.env.DB));
});

adminRoutes.post("/categories", async (c) => {
  const parsed = await parseJson<TaxonomyInput>(c, taxonomySchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  return ok(c, await createCategory(c.env.DB, parsed.data), 201);
});

adminRoutes.put("/categories/:id", async (c) => {
  const parsed = await parseJson(c, taxonomyUpdateSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const category = await updateCategory(c.env.DB, c.req.param("id"), parsed.data);

  if (!category) {
    return fail(c, 404, "CATEGORY_NOT_FOUND", "No category matched the requested id.");
  }

  return ok(c, category);
});

adminRoutes.delete("/categories/:id", async (c) => {
  const deleted = await deleteCategory(c.env.DB, c.req.param("id"));

  if (!deleted) {
    return fail(c, 404, "CATEGORY_NOT_FOUND", "No category matched the requested id.");
  }

  return ok(c, { id: c.req.param("id"), deleted: true });
});

adminRoutes.get("/tags", async (c) => {
  return ok(c, await listTagsForAdmin(c.env.DB));
});

adminRoutes.post("/tags", async (c) => {
  const parsed = await parseJson<TaxonomyInput>(c, taxonomySchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  return ok(c, await createTag(c.env.DB, parsed.data), 201);
});

adminRoutes.put("/tags/:id", async (c) => {
  const parsed = await parseJson(c, taxonomyUpdateSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const tag = await updateTag(c.env.DB, c.req.param("id"), parsed.data);

  if (!tag) {
    return fail(c, 404, "TAG_NOT_FOUND", "No tag matched the requested id.");
  }

  return ok(c, tag);
});

adminRoutes.delete("/tags/:id", async (c) => {
  const deleted = await deleteTag(c.env.DB, c.req.param("id"));

  if (!deleted) {
    return fail(c, 404, "TAG_NOT_FOUND", "No tag matched the requested id.");
  }

  return ok(c, { id: c.req.param("id"), deleted: true });
});

adminRoutes.get("/media", async (c) => {
  return ok(c, await listMediaAssets(c.env.DB, c.env.R2_PUBLIC_BASE_URL));
});

adminRoutes.post("/media", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || typeof file !== "object" || !("arrayBuffer" in file) || !("name" in file)) {
    return fail(c, 400, "INVALID_FILE", "A file upload is required.");
  }

  let asset;

  try {
    asset = await storeMediaAsset(c.env, file as File, {
      postSlug: (formData.get("postSlug") as string | null) ?? null,
      altText: (formData.get("altText") as string | null) ?? null,
    });
  } catch (error) {
    if (error instanceof MediaUploadError) {
      return fail(c, error.status, error.code, error.message);
    }

    throw error;
  }

  return ok(c, asset, 201);
});

adminRoutes.put("/media/:id", async (c) => {
  const parsed = await parseJson(c, mediaUpdateSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const asset = await updateMediaAssetMeta(c.env.DB, c.env.R2_PUBLIC_BASE_URL, c.req.param("id"), parsed.data);

  if (!asset) {
    return fail(c, 404, "MEDIA_NOT_FOUND", "No media asset matched the requested id.");
  }

  return ok(c, asset);
});

export default adminRoutes;
