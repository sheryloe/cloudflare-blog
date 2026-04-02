import { defineCollection, z } from "astro:content";
import { POST_LANGS } from "@cloudflare-blog/content-schema";

const posts = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    lang: z.enum(POST_LANGS),
    groupId: z.string(),
    translationOf: z.string().nullable(),
    publishedAt: z.string(),
    updatedAt: z.string(),
    draft: z.boolean(),
    coverImage: z.string(),
    coverAlt: z.string(),
    tags: z.array(z.string()),
    category: z.string(),
    canonicalLang: z.enum(POST_LANGS),
    ogImage: z.string(),
  }),
});

export const collections = { posts };
