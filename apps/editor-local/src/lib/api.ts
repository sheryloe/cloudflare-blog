export type DraftDocument = {
  id: string;
  groupId: string;
  sourceLang: "ko" | "en";
  title: string;
  slug: string;
  description: string;
  tags: string[];
  category: string;
  bodyHtml: string;
  translated: Partial<Record<"ko" | "en", GeneratedPost>>;
  assets: LocalAsset[];
  score: ScoreResult | null;
  coverImage: string;
  coverAlt: string;
  updatedAt: string;
};

export type GeneratedPost = {
  lang: "ko" | "en";
  html: string;
  title: string;
  description: string;
  warnings: string[];
};

export type LocalAsset = {
  id: string;
  url: string;
  path: string;
  altText: string;
};

export type ScoreResult = {
  total: number;
  status: "publish" | "review" | "revise" | "retry";
  metrics: Record<string, number>;
  warnings: string[];
};

const API_BASE_URL = import.meta.env.VITE_LOCAL_API_BASE_URL?.trim() || "http://127.0.0.1:4319";

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}) {
  const headers = new Headers(init.headers);
  let body = init.body;

  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    body,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message || "Local API request failed.");
  }

  return (await response.json()) as T;
}

export function buildEmptyDraft(): DraftDocument {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    groupId: crypto.randomUUID(),
    sourceLang: "ko",
    title: "",
    slug: "",
    description: "",
    tags: [],
    category: "guide",
    bodyHtml: "<p>Start writing here.</p>",
    translated: {},
    assets: [],
    score: null,
    coverImage: "",
    coverAlt: "",
    updatedAt: now,
  };
}

export function parseTagInput(value: string) {
  const tags = value
    .split(",")
    .map((tag) => tag.replace(/^#+/g, "").trim())
    .filter(Boolean);

  return [...new Map(tags.map((tag) => [tag.toLowerCase(), tag])).values()].slice(0, 10);
}

export async function saveDraft(draft: DraftDocument) {
  return request<{ saved: true; id: string }>("/api/local/save-draft", {
    method: "POST",
    json: draft,
  });
}

export async function loadDraft(id: string) {
  return request<DraftDocument>(`/api/local/load-draft/${id}`);
}

export async function saveAsset(file: File, slug: string, altText: string) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("slug", slug);
  formData.set("altText", altText);

  const response = await fetch(`${API_BASE_URL}/api/local/save-assets`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message || "Asset upload failed.");
  }

  return (await response.json()) as LocalAsset;
}

export async function translateDocument(input: {
  html: string;
  title: string;
  description: string;
  sourceLang: "ko" | "en";
  targetLang: "ko" | "en";
}) {
  return request<GeneratedPost>("/api/local/translate", {
    method: "POST",
    json: input,
  });
}

export async function scoreDocument(input: {
  sourceHtml: string;
  translatedHtml: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
}) {
  return request<ScoreResult>("/api/local/score", {
    method: "POST",
    json: input,
  });
}

export async function exportMdx(input: {
  lang: "ko" | "en";
  title: string;
  description: string;
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
  canonicalLang: "ko" | "en";
  ogImage: string;
  html: string;
}) {
  return request<{ mdx: string }>("/api/local/export-mdx", {
    method: "POST",
    json: input,
  });
}
