import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

export default defineConfig({
  site: "http://127.0.0.1:4321",
  output: "static",
  integrations: [mdx()],
  markdown: {
    syntaxHighlight: "shiki",
  },
});
