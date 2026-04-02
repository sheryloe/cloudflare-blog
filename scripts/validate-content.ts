import fg from "fast-glob";
import matter from "gray-matter";
import fs from "node:fs/promises";
import path from "node:path";

import { parsePostFrontmatter } from "@cloudflare-blog/content-schema";

async function main() {
  const repoRoot = process.cwd();
  const contentRoot = path.join(repoRoot, "apps", "blog-web", "src", "content", "posts");
  const publicRoot = path.join(repoRoot, "apps", "blog-web", "public");
  const files = await fg(["**/*.mdx"], { cwd: contentRoot, absolute: true });

  const seenSlugs = new Set<string>();
  const groupMap = new Map<string, Set<string>>();
  const problems: string[] = [];

  for (const file of files) {
    const relative = path.relative(contentRoot, file);
    const fileContent = await fs.readFile(file, "utf8");
    const parsed = matter(fileContent);
    const frontmatter = parsePostFrontmatter(parsed.data);
    const expectedFolder = frontmatter.lang;

    if (!relative.startsWith(`${expectedFolder}${path.sep}`)) {
      problems.push(`${relative}: lang frontmatter and folder do not match.`);
    }

    const slugKey = `${frontmatter.lang}:${frontmatter.slug}`;

    if (seenSlugs.has(slugKey)) {
      problems.push(`${relative}: duplicate slug ${slugKey}.`);
    }

    seenSlugs.add(slugKey);
    groupMap.set(frontmatter.groupId, new Set([...(groupMap.get(frontmatter.groupId) ?? []), frontmatter.lang]));

    for (const assetPath of [frontmatter.coverImage, frontmatter.ogImage]) {
      const normalized = assetPath.replace(/^\//, "");
      try {
        await fs.access(path.join(publicRoot, normalized));
      } catch {
        problems.push(`${relative}: missing asset ${assetPath}.`);
      }
    }

    const imageMatches = parsed.content.matchAll(/<img[^>]+src="([^"]+)"/g);

    for (const match of imageMatches) {
      const assetPath = match[1];

      if (/^https?:\/\//.test(assetPath)) {
        continue;
      }

      try {
        await fs.access(path.join(publicRoot, assetPath.replace(/^\//, "")));
      } catch {
        problems.push(`${relative}: missing body image ${assetPath}.`);
      }
    }
  }

  for (const [groupId, languages] of groupMap.entries()) {
    if (!languages.has("ko") || !languages.has("en")) {
      problems.push(`groupId ${groupId}: ko/en pair is incomplete.`);
    }
  }

  if (problems.length) {
    console.error("Content validation failed:");
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`Validated ${files.length} content files successfully.`);
}

void main();
