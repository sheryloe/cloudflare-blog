import { Hono } from "hono";

import { fail, ok } from "../lib/http";
import {
  getCategoryFeedBySlug,
  getPublishedPostBySlug,
  getTagFeedBySlug,
  listCategories,
  listPublishedPosts,
} from "../lib/posts";
import type { AppEnv } from "../types";

const publicRoutes = new Hono<AppEnv>();

publicRoutes.get("/posts", async (c) => {
  const posts = await listPublishedPosts(c.env.DB);
  return ok(c, posts);
});

publicRoutes.get("/posts/:slug", async (c) => {
  const post = await getPublishedPostBySlug(c.env.DB, c.req.param("slug"));

  if (!post) {
    return fail(c, 404, "POST_NOT_FOUND", "No published post matched the requested slug.");
  }

  return ok(c, post);
});

publicRoutes.get("/categories", async (c) => {
  const categories = await listCategories(c.env.DB);
  return ok(c, categories);
});

publicRoutes.get("/categories/:slug/posts", async (c) => {
  const feed = await getCategoryFeedBySlug(c.env.DB, c.req.param("slug"));

  if (!feed) {
    return fail(c, 404, "CATEGORY_NOT_FOUND", "No category matched the requested slug.");
  }

  return ok(c, feed);
});

publicRoutes.get("/tags/:slug/posts", async (c) => {
  const feed = await getTagFeedBySlug(c.env.DB, c.req.param("slug"));

  if (!feed) {
    return fail(c, 404, "TAG_NOT_FOUND", "No tag matched the requested slug.");
  }

  return ok(c, feed);
});

export default publicRoutes;
