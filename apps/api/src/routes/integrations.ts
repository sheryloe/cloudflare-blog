import { Hono } from "hono";
import { z } from "zod";

import {
  createAutomationRun,
  listAutomationPlanItems,
  replaceAutomationPlanItems,
  updateAutomationPlanItem,
  updateAutomationRun,
} from "../lib/automation-plan";
import { fail, ok, parseJson } from "../lib/http";
import { requireIntegrationAuth } from "../lib/integration-auth";
import { MediaUploadError, storeMediaAsset } from "../lib/media";
import { createPost, getAdminPostById, listAdminPosts, updatePost } from "../lib/posts";
import {
  getPromptCategoryBySlug,
  isPromptStage,
  listAutomationRuns,
  listPromptCategories,
  listPromptTemplates,
  PROMPT_STAGES,
  upsertPromptTemplate,
} from "../lib/prompts";
import { listPromptCatalog, syncPromptCatalog } from "../lib/prompt-catalog";
import { getSiteSettings } from "../lib/site-settings";
import { listCategoriesForAdmin, resolveCategoryIdentifier } from "../lib/taxonomies";
import type { AppEnv } from "../types";

const integrationsRoutes = new Hono<AppEnv>();

const promptUpdateSchema = z.object({
  content: z.string().trim().min(20),
});

const promptCatalogSyncSchema = z.object({
  slugs: z.array(z.string().trim().min(1)).max(50).optional(),
});

const automationPlanReplaceSchema = z.object({
  planDateKst: z.string().trim().min(10),
  items: z
    .array(
      z.object({
        id: z.string().trim().optional(),
        planDateKst: z.string().trim().optional(),
        slotTimeKst: z.string().trim().min(1),
        slotOrder: z.number().int().min(0),
        categoryId: z.string().trim().nullable().optional(),
        categorySlug: z.string().trim().min(1),
        status: z.string().trim().optional(),
        postId: z.string().trim().nullable().optional(),
        plannerRunId: z.string().trim().nullable().optional(),
        errorSummary: z.string().trim().nullable().optional(),
        metadata: z.record(z.unknown()).optional(),
        executedAt: z.string().trim().nullable().optional(),
      }),
    )
    .max(24),
});

const automationPlanUpdateSchema = z
  .object({
    status: z.string().trim().optional(),
    postId: z.string().trim().nullable().optional(),
    plannerRunId: z.string().trim().nullable().optional(),
    errorSummary: z.string().trim().nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
    executedAt: z.string().trim().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one automation plan field must be provided.",
  });

const automationRunCreateSchema = z.object({
  id: z.string().trim().optional(),
  categoryId: z.string().trim().nullable().optional(),
  categorySlug: z.string().trim().min(1),
  status: z.string().trim().min(1),
  triggerType: z.string().trim().min(1),
  summary: z.string().trim().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  startedAt: z.string().trim().optional(),
  finishedAt: z.string().trim().nullable().optional(),
});

const automationRunUpdateSchema = z
  .object({
    status: z.string().trim().optional(),
    summary: z.string().trim().nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
    finishedAt: z.string().trim().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one automation run field must be provided.",
  });

const integrationPostUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    subtitle: z.string().trim().nullable().optional(),
    excerpt: z.string().trim().nullable().optional(),
    content: z.string().min(1).optional(),
    categoryId: z.string().trim().nullable().optional(),
    tagIds: z.array(z.string().trim().min(1)).optional(),
    tagNames: z.array(z.string().trim().min(1)).max(20).optional(),
    coverImage: z.string().trim().nullable().optional(),
    coverAlt: z.string().trim().nullable().optional(),
    youtubeUrl: z.string().trim().nullable().optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    publishedAt: z.string().trim().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one post field must be provided.",
  });

const integrationPostCreateSchema = z.object({
  title: z.string().trim().min(1),
  excerpt: z.string().trim().nullable().optional(),
  content: z.string().min(1),
  category: z.string().trim().nullable().optional(),
  categoryId: z.string().trim().nullable().optional(),
  tagNames: z.array(z.string().trim().min(1)).max(20).optional(),
  coverImage: z.string().trim().nullable().optional(),
  coverAlt: z.string().trim().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  publishedAt: z.string().trim().nullable().optional(),
  slug: z.string().trim().min(1).optional(),
});

function resolvePublicOrigin(c: Parameters<typeof requireIntegrationAuth>[0]) {
  const configured = (c.env.PUBLIC_APP_ORIGIN ?? "").split(",")[0]?.trim();

  if (!configured) {
    return "https://example.com";
  }

  try {
    return new URL(configured).origin;
  } catch {
    return configured.replace(/\/$/, "");
  }
}

integrationsRoutes.use("*", async (c, next) => {
  const authResponse = requireIntegrationAuth(c);

  if (authResponse instanceof Response) {
    return authResponse;
  }

  return next();
});

integrationsRoutes.get("/posts", async (c) => {
  const summaries = await listAdminPosts(c.env.DB);
  const baseUrl = resolvePublicOrigin(c);

  return ok(
    c,
    summaries.map((post) => ({
      ...post,
      publicUrl: post.status === "published" ? `${baseUrl}/ko/post/${post.slug}` : null,
      providerStatus: post.status,
      channelId: "cloudflare-main",
      channelName: "Dongri Archive",
    })),
  );
});

integrationsRoutes.get("/posts/:id", async (c) => {
  const post = await getAdminPostById(c.env.DB, c.req.param("id"));

  if (!post) {
    return fail(c, 404, "POST_NOT_FOUND", "No post matched the requested id.");
  }

  return ok(c, {
    ...post,
    publicUrl: post.status === "published" ? `${resolvePublicOrigin(c)}/ko/post/${post.slug}` : null,
    providerStatus: post.status,
    channelId: "cloudflare-main",
    channelName: "Dongri Archive",
  });
});

integrationsRoutes.post("/posts", async (c) => {
  const parsed = await parseJson(c, integrationPostCreateSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const body = parsed.data;
  const categoryResolveInput = (body.categoryId ?? body.category)?.trim();
  const resolvedCategoryId = categoryResolveInput
    ? await resolveCategoryIdentifier(c.env.DB, categoryResolveInput)
    : null;

  if (categoryResolveInput && !resolvedCategoryId) {
    return fail(c, 404, "CATEGORY_NOT_FOUND", "Category could not be resolved.");
  }

  const post = await createPost(c.env.DB, {
    title: body.title,
    slug: body.slug,
    excerpt: body.excerpt,
    content: body.content,
    categoryId: resolvedCategoryId,
    tagNames: body.tagNames,
    coverImage: body.coverImage,
    coverAlt: body.coverAlt,
    status: body.status ?? "draft",
    publishedAt: body.publishedAt,
  });

  if (!post) {
    return fail(c, 500, "POST_CREATE_FAILED", "Post could not be created.");
  }

  return ok(c, {
    ...post,
    publicUrl: post.status === "published" ? `${resolvePublicOrigin(c)}/ko/post/${post.slug}` : null,
    providerStatus: post.status,
    channelId: "cloudflare-main",
    channelName: "Dongri Archive",
  }, 201);
});

integrationsRoutes.put("/posts/:id", async (c) => {
  const parsed = await parseJson(c, integrationPostUpdateSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const post = await updatePost(c.env.DB, c.req.param("id"), parsed.data);

  if (!post) {
    return fail(c, 404, "POST_NOT_FOUND", "No post matched the requested id.");
  }

  return ok(c, {
    ...post,
    publicUrl: post.status === "published" ? `${resolvePublicOrigin(c)}/ko/post/${post.slug}` : null,
    providerStatus: post.status,
    channelId: "cloudflare-main",
    channelName: "Dongri Archive",
  });
});

integrationsRoutes.get("/categories", async (c) => {
  const catalogSlugs = new Set(listPromptCatalog().map((item) => item.slug));
  const categories = await listPromptCategories(c.env.DB);
  return ok(c, categories.filter((item) => catalogSlugs.has(item.slug)));
});

integrationsRoutes.get("/post-categories", async (c) => {
  return ok(c, await listCategoriesForAdmin(c.env.DB));
});

integrationsRoutes.get("/prompt-catalog", async (c) => {
  return ok(c, listPromptCatalog());
});

integrationsRoutes.get("/runs", async (c) => {
  const rawLimit = Number(c.req.query("limit") ?? "30");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 30;
  return ok(c, await listAutomationRuns(c.env.DB, limit));
});

integrationsRoutes.post("/runs", async (c) => {
  const parsed = await parseJson(c, automationRunCreateSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const created = await createAutomationRun(c.env.DB, parsed.data);
  return ok(c, created, 201);
});

integrationsRoutes.put("/runs/:id", async (c) => {
  const parsed = await parseJson(c, automationRunUpdateSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const updated = await updateAutomationRun(c.env.DB, c.req.param("id"), parsed.data);
  if (!updated) {
    return fail(c, 404, "RUN_NOT_FOUND", "No automation run matched the requested id.");
  }
  return ok(c, updated);
});

integrationsRoutes.get("/automation-plan", async (c) => {
  const date = (c.req.query("date") ?? "").trim();
  const dueBefore = (c.req.query("due_before") ?? "").trim();
  const recent = (c.req.query("recent") ?? "").trim().toLowerCase() === "true";
  const rawLimit = Number(c.req.query("limit") ?? "50");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 50;

  return ok(
    c,
    await listAutomationPlanItems(c.env.DB, {
      planDateKst: date || undefined,
      dueBefore: dueBefore || undefined,
      recent,
      limit,
    }),
  );
});

integrationsRoutes.post("/automation-plan", async (c) => {
  const parsed = await parseJson(c, automationPlanReplaceSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const items = await replaceAutomationPlanItems(c.env.DB, parsed.data);
  return ok(c, items, 201);
});

integrationsRoutes.put("/automation-plan/:id", async (c) => {
  const parsed = await parseJson(c, automationPlanUpdateSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const updated = await updateAutomationPlanItem(c.env.DB, c.req.param("id"), parsed.data);
  if (!updated) {
    return fail(c, 404, "PLAN_ITEM_NOT_FOUND", "No automation plan item matched the requested id.");
  }
  return ok(c, updated);
});

integrationsRoutes.get("/site-settings", async (c) => {
  return ok(c, await getSiteSettings(c.env.DB));
});

integrationsRoutes.post("/assets", async (c) => {
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

  if (!asset) {
    return fail(c, 500, "ASSET_UPLOAD_FAILED", "Asset metadata could not be loaded after upload.");
  }

  return ok(
    c,
    {
      ...asset,
      objectKey: asset.path,
      publicBaseUrl: c.env.R2_PUBLIC_BASE_URL,
      provider: "cloudflare_r2",
    },
    201,
  );
});

integrationsRoutes.get("/prompts", async (c) => {
  const catalogItems = listPromptCatalog();
  const catalogSlugs = new Set(catalogItems.map((item) => item.slug));
  const catalogMap = new Map(catalogItems.map((item) => [item.slug, item]));
  const categories = (await listPromptCategories(c.env.DB))
    .filter((item) => catalogSlugs.has(item.slug))
    .map((item) => {
      const catalog = catalogMap.get(item.slug);
      if (!catalog) {
        return item;
      }
      return {
        ...item,
        postCategorySlug: catalog.postCategorySlug,
        targetLengthMin: catalog.targetLengthMin,
        targetLengthMax: catalog.targetLengthMax,
        targetLengthBand: catalog.targetLengthBand,
        freshnessMode: catalog.freshnessMode,
        preferredDiscoveryModel: catalog.preferredDiscoveryModel,
        preferredArticleModel: catalog.preferredArticleModel,
        preferredReviewModel: catalog.preferredReviewModel,
        preferredRevisionModel: catalog.preferredRevisionModel,
        preferredImagePromptModel: catalog.preferredImagePromptModel,
      };
    });
  const templates = await listPromptTemplates(c.env.DB);

  return ok(c, {
    categories,
    templates: templates.filter((item) => catalogSlugs.has(item.categorySlug)),
    stages: [...PROMPT_STAGES],
  });
});

integrationsRoutes.put("/prompts/:category/:stage", async (c) => {
  const stage = c.req.param("stage").trim();

  if (!isPromptStage(stage)) {
    return fail(c, 422, "INVALID_PROMPT_STAGE", "Unsupported prompt stage.");
  }

  const category = await getPromptCategoryBySlug(c.env.DB, c.req.param("category").trim());

  if (!category) {
    return fail(c, 404, "CATEGORY_NOT_FOUND", "No prompt category matched the requested slug.");
  }

  const parsed = await parseJson<{ content: string }>(c, promptUpdateSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const template = await upsertPromptTemplate(c.env.DB, {
    categorySlug: category.slug,
    stage,
    content: parsed.data.content,
  });

  if (!template) {
    return fail(c, 500, "PROMPT_SAVE_FAILED", "Prompt could not be saved.");
  }

  return ok(c, template);
});

integrationsRoutes.post("/prompt-catalog/sync", async (c) => {
  const parsed = await parseJson<{ slugs?: string[] }>(c, promptCatalogSyncSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const result = await syncPromptCatalog(c.env.DB, parsed.data.slugs);
  return ok(c, result);
});

export default integrationsRoutes;
