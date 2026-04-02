import { z } from "zod";

export const POST_LANGS = ["ko", "en"] as const;
export type PostLang = (typeof POST_LANGS)[number];

export interface PostFrontmatter {
  title: string;
  description: string;
  lang: PostLang;
  slug: string;
  groupId: string;
  translationOf: string | null;
  publishedAt: string;
  updatedAt: string;
  draft: boolean;
  coverImage: string;
  coverAlt: string;
  tags: string[];
  category: string;
  canonicalLang: PostLang;
  ogImage: string;
}

type SchemaFactory = {
  object: (shape: Record<string, unknown>) => any;
  string: () => any;
  enum: (values: readonly string[]) => any;
  boolean: () => any;
  array: (schema: unknown) => any;
  literal?: (value: string | null) => any;
  union?: (schemas: unknown[]) => any;
  null?: () => any;
};

export function createPostFrontmatterSchema(schemaFactory: SchemaFactory) {
  const nullableString =
    schemaFactory.union && schemaFactory.null
      ? schemaFactory.union([schemaFactory.string(), schemaFactory.null()])
      : schemaFactory.string();

  return schemaFactory.object({
    title: schemaFactory.string(),
    description: schemaFactory.string(),
    lang: schemaFactory.enum(POST_LANGS),
    slug: schemaFactory.string(),
    groupId: schemaFactory.string(),
    translationOf: nullableString,
    publishedAt: schemaFactory.string(),
    updatedAt: schemaFactory.string(),
    draft: schemaFactory.boolean(),
    coverImage: schemaFactory.string(),
    coverAlt: schemaFactory.string(),
    tags: schemaFactory.array(schemaFactory.string()),
    category: schemaFactory.string(),
    canonicalLang: schemaFactory.enum(POST_LANGS),
    ogImage: schemaFactory.string(),
  });
}

export const postFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  lang: z.enum(POST_LANGS),
  slug: z.string().min(1),
  groupId: z.string().min(1),
  translationOf: z.string().nullable(),
  publishedAt: z.string().min(1),
  updatedAt: z.string().min(1),
  draft: z.boolean(),
  coverImage: z.string().min(1),
  coverAlt: z.string().min(1),
  tags: z.array(z.string().min(1)),
  category: z.string().min(1),
  canonicalLang: z.enum(POST_LANGS),
  ogImage: z.string().min(1),
});

export function parsePostFrontmatter(input: unknown) {
  return postFrontmatterSchema.parse(input);
}
