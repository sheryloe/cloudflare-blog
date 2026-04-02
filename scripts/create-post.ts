import fs from "node:fs/promises";
import path from "node:path";

import { slugify } from "@cloudflare-blog/shared-utils";

async function main() {
  const repoRoot = process.cwd();
  const [titleArg, categoryArg = "guide"] = process.argv.slice(2);

  if (!titleArg) {
    console.error("Usage: tsx scripts/create-post.ts \"Post title\" [category]");
    process.exit(1);
  }

  const slug = slugify(titleArg) || "new-post";
  const groupId = `${new Date().toISOString().slice(0, 10)}-${slug}`;
  const date = new Date().toISOString().slice(0, 10);

  function template(lang: "ko" | "en") {
    return `---
title: "${titleArg}"
description: "${lang === "ko" ? "글 요약을 입력하세요." : "Write the post summary."}"
lang: "${lang}"
slug: "${slug}"
groupId: "${groupId}"
translationOf: ${lang === "ko" ? "null" : `"${slug}"`}
publishedAt: "${date}"
updatedAt: "${date}"
draft: true
coverImage: "/images/posts/${slug}/cover.webp"
coverAlt: "${titleArg}"
tags: []
category: "${categoryArg}"
canonicalLang: "ko"
ogImage: "/images/posts/${slug}/cover.webp"
---

<p>${lang === "ko" ? "본문을 입력하세요." : "Write your post body."}</p>
`;
  }

  await fs.mkdir(path.join(repoRoot, "apps", "blog-web", "src", "content", "posts", "ko"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, "apps", "blog-web", "src", "content", "posts", "en"), { recursive: true });

  await fs.writeFile(
    path.join(repoRoot, "apps", "blog-web", "src", "content", "posts", "ko", `${slug}.mdx`),
    template("ko"),
    "utf8",
  );
  await fs.writeFile(
    path.join(repoRoot, "apps", "blog-web", "src", "content", "posts", "en", `${slug}.mdx`),
    template("en"),
    "utf8",
  );

  console.log(`Created post templates for ${slug}.`);
}

void main();
