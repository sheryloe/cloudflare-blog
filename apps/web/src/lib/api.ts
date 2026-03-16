import type {
  ApiResponse,
  Category,
  CategoryFeed,
  Post,
  PostSummary,
  TagFeed,
} from "@donggeuri/shared";

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (import.meta.env.DEV) {
    return "http://127.0.0.1:8787";
  }

  throw new Error("VITE_API_BASE_URL must be configured for the public app.");
}

const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
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
    credentials: "include",
  });

  let payload: ApiResponse<T> | null = null;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    throw new ApiError(
      payload && !payload.success ? payload.error.message : "Request failed.",
      response.status,
      payload && !payload.success ? payload.error.code : undefined,
    );
  }

  return payload.data;
}

export function listPosts() {
  return request<PostSummary[]>("/api/public/posts");
}

export function getPost(slug: string) {
  return request<Post>(`/api/public/posts/${slug}`);
}

export function listCategories() {
  return request<Category[]>("/api/public/categories");
}

export function getCategoryFeed(slug: string) {
  return request<CategoryFeed>(`/api/public/categories/${slug}/posts`);
}

export function getTagFeed(slug: string) {
  return request<TagFeed>(`/api/public/tags/${slug}/posts`);
}
