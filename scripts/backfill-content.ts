import fs from "node:fs/promises";
import path from "node:path";

import { slugify } from "@cloudflare-blog/shared-utils";

async function main() {
  const apiBaseUrl = process.env.BACKFILL_API_BASE_URL || "http://127.0.0.1:8787";
  const email = process.env.BACKFILL_ADMIN_EMAIL || "admin@example.com";
  const password = process.env.BACKFILL_ADMIN_PASSWORD || "admin123!";
  const outputEnStub = process.env.BACKFILL_OUTPUT_EN_STUB === "true";
  const repoRoot = process.cwd();
  const cookieJar = new Map<string, string>();

  async function request<T>(pathName: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    const cookie = [...cookieJar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");

    if (cookie) {
      headers.set("Cookie", cookie);
    }

    const response = await fetch(`${apiBaseUrl}${pathName}`, {
      ...init,
      headers,
    });

    const setCookie = response.headers.getSetCookie?.() ?? [];

    for (const item of setCookie) {
      const [pair] = item.split(";");
      const [key, value] = pair.split("=");

      if (key && value) {
        cookieJar.set(key, value);
      }
    }

    if (!response.ok) {
      throw new Error(`Backfill request failed: ${response.status} ${pathName}`);
    }

    const payload = (await response.json()) as { data: T };
    return payload.data;
  }

  await request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const posts = await request<Array<{ id: string }>>("/api/admin/posts");

  for (const summary of posts) {
    const post = await request<{
      slug: string;
      title: string;
      excerpt?: string | null;
      content: string;
      coverImage?: string | null;
      category?: { slug: string } | null;
      tags: Array<{ slug: string }>;
    }>(`/api/admin/posts/${summary.id}`);

    const slug = slugify(post.slug || post.title) || post.slug || "legacy-post";
    const date = new Date().toISOString().slice(0, 10);
    const groupId = `legacy-${slug}`;
    const category = post.category?.slug || "guide";
    const tags = post.tags.map((tag) => tag.slug);
    const cover = post.coverImage || `/images/posts/${slug}/cover.webp`;
    const description = post.excerpt || post.title;
    const koOutput = `---
title: "${post.title}"
description: "${description}"
lang: "ko"
slug: "${slug}"
groupId: "${groupId}"
translationOf: null
publishedAt: "${date}"
updatedAt: "${date}"
draft: false
coverImage: "${cover}"
coverAlt: "${post.title}"
tags: [${tags.map((tag) => `"${tag}"`).join(", ")}]
category: "${category}"
canonicalLang: "ko"
ogImage: "${cover}"
---

${post.content}
`;

    await fs.mkdir(path.join(repoRoot, "apps", "blog-web", "src", "content", "posts", "ko"), { recursive: true });
    await fs.writeFile(
      path.join(repoRoot, "apps", "blog-web", "src", "content", "posts", "ko", `${slug}.mdx`),
      koOutput,
      "utf8",
    );

    if (outputEnStub) {
      const enOutput = `---
title: "${post.title}"
description: "${description}"
lang: "en"
slug: "${slug}"
groupId: "${groupId}"
translationOf: "${slug}"
publishedAt: "${date}"
updatedAt: "${date}"
draft: true
coverImage: "${cover}"
coverAlt: "${post.title}"
tags: [${tags.map((tag) => `"${tag}"`).join(", ")}]
category: "${category}"
canonicalLang: "ko"
ogImage: "${cover}"
---

${post.content}
`;

      await fs.mkdir(path.join(repoRoot, "apps", "blog-web", "src", "content", "posts", "en"), { recursive: true });
      await fs.writeFile(
        path.join(repoRoot, "apps", "blog-web", "src", "content", "posts", "en", `${slug}.mdx`),
        enOutput,
        "utf8",
      );
    }
  }

  console.log(`Backfilled ${posts.length} posts into apps/blog-web.`);
}

void main();
