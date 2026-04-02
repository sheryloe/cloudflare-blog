import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";

export type BlogPostEntry = CollectionEntry<"posts">;

export async function getPosts(lang?: "ko" | "en") {
  const posts = await getCollection("posts", (entry: BlogPostEntry) => (lang ? entry.data.lang === lang : true));

  return posts.sort(
    (left: BlogPostEntry, right: BlogPostEntry) =>
      new Date(right.data.publishedAt).getTime() - new Date(left.data.publishedAt).getTime(),
  );
}

export function postPath(post: BlogPostEntry) {
  return `/${post.data.lang}/posts/${post.slug}/`;
}

export function tagPath(lang: "ko" | "en", tag: string) {
  return `/${lang}/tags/${tag}/`;
}

export function categoryPath(lang: "ko" | "en", category: string) {
  return `/${lang}/categories/${category}/`;
}

export async function getTranslations(groupId: string) {
  const posts = await getCollection("posts", (entry: BlogPostEntry) => entry.data.groupId === groupId);
  return Object.fromEntries(posts.map((post: BlogPostEntry) => [post.data.lang, post])) as Partial<
    Record<"ko" | "en", BlogPostEntry>
  >;
}

export async function getTagMap(lang: "ko" | "en") {
  const posts = await getPosts(lang);
  const map = new Map<string, BlogPostEntry[]>();

  for (const post of posts) {
    for (const tag of post.data.tags) {
      map.set(tag, [...(map.get(tag) ?? []), post]);
    }
  }

  return map;
}

export async function getCategoryMap(lang: "ko" | "en") {
  const posts = await getPosts(lang);
  const map = new Map<string, BlogPostEntry[]>();

  for (const post of posts) {
    const category = post.data.category;
    map.set(category, [...(map.get(category) ?? []), post]);
  }

  return map;
}
