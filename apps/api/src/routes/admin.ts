import { Hono } from "hono";
import { z } from "zod";

import type { LoginInput, TaxonomyInput } from "@donggeuri/shared";

import { clearAdminSession, createAdminSession, getAdminSession, verifyAdminCredentials } from "../lib/auth";
import { fail, ok, parseJson, requireAdmin } from "../lib/http";
import { listMediaAssets, storeMediaAsset } from "../lib/media";
import { createPost, deletePost, getAdminPostById, listAdminPosts, updatePost } from "../lib/posts";
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

const postInputSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().trim().nullable().optional(),
  slug: z.string().trim().min(1).optional(),
  excerpt: z.string().trim().nullable().optional(),
  content: z.string().min(1),
  categoryId: z.string().trim().nullable().optional(),
  tagIds: z.array(z.string().trim().min(1)).optional(),
  coverImage: z.string().trim().nullable().optional(),
  youtubeUrl: z.string().trim().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  publishedAt: z.string().trim().nullable().optional(),
});

const postUpdateSchema = postInputSchema.partial();

const taxonomySchema = z.object({
  name: z.string().min(1),
  slug: z.string().trim().optional(),
  description: z.string().trim().nullable().optional(),
});
const taxonomyUpdateSchema = taxonomySchema
  .partial()
  .refine((value) => Boolean(value.name || value.slug || value.description !== undefined));

const adminRoutes = new Hono<AppEnv>();

adminRoutes.post("/login", async (c) => {
  const parsed = await parseJson<LoginInput>(c, loginSchema);

  if ("response" in parsed) {
    return parsed.response;
  }

  const valid = await verifyAdminCredentials(parsed.data, c.env);

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

adminRoutes.use("*", requireAdmin);

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

  const asset = await storeMediaAsset(c.env, file as File, {
    postSlug: (formData.get("postSlug") as string | null) ?? null,
    altText: (formData.get("altText") as string | null) ?? null,
  });

  return ok(c, asset, 201);
});

export default adminRoutes;
