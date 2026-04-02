import { Hono } from "hono";

import { fail, ok } from "../lib/http";
import {
  getCategoryFeedBySlug,
  getPublishedPostBySlug,
  getTagFeedBySlug,
  listCategories,
  listPublishedPosts,
  listTopPublishedPosts,
  recordPostViewBySlug,
  searchPublishedPosts,
} from "../lib/posts";
import { consumeRateLimit } from "../lib/rate-limit";
import { getSiteSettings } from "../lib/site-settings";
import type { AppEnv } from "../types";

const publicRoutes = new Hono<AppEnv>();
const POSTS_CACHE_CONTROL = "public, max-age=30, s-maxage=60, stale-while-revalidate=300";
const META_CACHE_CONTROL = "public, max-age=120, s-maxage=300, stale-while-revalidate=1800";

function withCacheControl(response: Response, value: string) {
  response.headers.set("Cache-Control", value);
  return response;
}

publicRoutes.get("/posts", async (c) => {
  const posts = await listPublishedPosts(c.env.DB);
  return withCacheControl(ok(c, posts), POSTS_CACHE_CONTROL);
});

publicRoutes.get("/posts/top", async (c) => {
  const requestedLimit = Number(c.req.query("limit") ?? "5");
  const posts = await listTopPublishedPosts(c.env.DB, requestedLimit);
  return withCacheControl(ok(c, posts), POSTS_CACHE_CONTROL);
});

publicRoutes.get("/search", async (c) => {
  const query = c.req.query("q")?.trim() ?? "";
  const posts = query ? await searchPublishedPosts(c.env.DB, query) : [];

  return ok(c, {
    query,
    posts,
  });
});

publicRoutes.get("/posts/:slug", async (c) => {
  const post = await getPublishedPostBySlug(c.env.DB, c.req.param("slug"));

  if (!post) {
    return fail(c, 404, "POST_NOT_FOUND", "No published post matched the requested slug.");
  }

  return ok(c, post);
});

publicRoutes.post("/posts/:slug/view", async (c) => {
  const slug = c.req.param("slug");
  const limit = consumeRateLimit({
    request: c.req.raw,
    scope: "public-view",
    subject: slug,
    limit: 120,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return fail(c, 429, "RATE_LIMITED", "Too many view events were submitted. Please retry soon.");
  }

  const result = await recordPostViewBySlug(c.env.DB, slug);

  if (!result) {
    return fail(c, 404, "POST_NOT_FOUND", "No published post matched the requested slug.");
  }

  return ok(c, result);
});

publicRoutes.get("/categories", async (c) => {
  const categories = await listCategories(c.env.DB);
  return withCacheControl(ok(c, categories), META_CACHE_CONTROL);
});

publicRoutes.get("/site-settings", async (c) => {
  return withCacheControl(ok(c, await getSiteSettings(c.env.DB)), META_CACHE_CONTROL);
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
