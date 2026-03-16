import type {
  ApiResponse,
  Category,
  CategoryFeed,
  Post,
  PostSummary,
  TagFeed,
} from "@donggeuri/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

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
