import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const repoRoot = process.cwd();
  const blogRoot = path.join(repoRoot, "apps", "blog-web");
  const files = await fg(["src/**/*.{ts,tsx,astro,js,mjs,md,mdx}"], {
    cwd: blogRoot,
    absolute: true,
  });
  const distFiles = await fg(["dist/**/*.{js,css,html,txt,map}"], {
    cwd: blogRoot,
    absolute: true,
  });

  const violations: string[] = [];

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");

    if (content.includes("apps/editor-local") || content.includes("@cloudflare-blog/editor-local")) {
      violations.push(path.relative(repoRoot, file));
    }
  }

  for (const file of distFiles) {
    const content = await fs.readFile(file, "utf8");

    if (
      content.includes("apps/editor-local") ||
      content.includes("@cloudflare-blog/editor-local") ||
      content.includes("LOCAL_EDITOR_PORT") ||
      content.includes("GEMINI_API_KEY")
    ) {
      violations.push(path.relative(repoRoot, file));
    }
  }

  if (violations.length) {
    console.error("Import boundary violations detected:");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log("Import boundary check passed.");
}

void main();
