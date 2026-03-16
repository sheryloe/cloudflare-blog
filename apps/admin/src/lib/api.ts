import type {
  AdminSession,
  ApiResponse,
  Category,
  CreatePostInput,
  LoginInput,
  MediaAsset,
  Post,
  PostSummary,
  Tag,
  TaxonomyInput,
  UpdatePostInput,
} from "@donggeuri/shared";

const ADMIN_TOKEN_STORAGE_KEY = "donggeuri_admin_token";

type LoginResult = {
  session: AdminSession;
  token: string;
};

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (import.meta.env.DEV) {
    return "http://127.0.0.1:8787";
  }

  throw new Error("VITE_API_BASE_URL must be configured for the admin app.");
}

const API_BASE_URL = resolveApiBaseUrl();

function getStoredAdminToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
}

function setStoredAdminToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

export function clearStoredAdminToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

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

  const token = getStoredAdminToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
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

export function getSession() {
  return request<AdminSession>("/api/admin/session");
}

export function login(credentials: LoginInput) {
  return request<LoginResult>("/api/admin/login", {
    method: "POST",
    json: credentials,
  }).then((result) => {
    setStoredAdminToken(result.token);
    return result.session;
  });
}

export function logout() {
  return request<{ loggedOut: true }>("/api/admin/logout", {
    method: "POST",
  });
}

export function listAdminPosts() {
  return request<PostSummary[]>("/api/admin/posts");
}

export function getAdminPost(id: string) {
  return request<Post>(`/api/admin/posts/${id}`);
}

export function createAdminPost(input: CreatePostInput) {
  return request<Post>("/api/admin/posts", {
    method: "POST",
    json: input,
  });
}

export function updateAdminPost(id: string, input: UpdatePostInput) {
  return request<Post>(`/api/admin/posts/${id}`, {
    method: "PUT",
    json: input,
  });
}

export function deleteAdminPost(id: string) {
  return request<{ id: string; deleted: boolean }>(`/api/admin/posts/${id}`, {
    method: "DELETE",
  });
}

export function listAdminCategories() {
  return request<Category[]>("/api/admin/categories");
}

export function createAdminCategory(input: TaxonomyInput) {
  return request<Category>("/api/admin/categories", {
    method: "POST",
    json: input,
  });
}

export function updateAdminCategory(id: string, input: Partial<TaxonomyInput>) {
  return request<Category>(`/api/admin/categories/${id}`, {
    method: "PUT",
    json: input,
  });
}

export function deleteAdminCategory(id: string) {
  return request<{ id: string; deleted: boolean }>(`/api/admin/categories/${id}`, {
    method: "DELETE",
  });
}

export function listAdminTags() {
  return request<Tag[]>("/api/admin/tags");
}

export function createAdminTag(input: TaxonomyInput) {
  return request<Tag>("/api/admin/tags", {
    method: "POST",
    json: input,
  });
}

export function updateAdminTag(id: string, input: Partial<TaxonomyInput>) {
  return request<Tag>(`/api/admin/tags/${id}`, {
    method: "PUT",
    json: input,
  });
}

export function deleteAdminTag(id: string) {
  return request<{ id: string; deleted: boolean }>(`/api/admin/tags/${id}`, {
    method: "DELETE",
  });
}

export function listMediaAssets() {
  return request<MediaAsset[]>("/api/admin/media");
}

export function uploadMediaAsset(input: { file: File; postSlug?: string; altText?: string }) {
  const formData = new FormData();
  formData.set("file", input.file);

  if (input.postSlug) {
    formData.set("postSlug", input.postSlug);
  }

  if (input.altText) {
    formData.set("altText", input.altText);
  }

  return request<MediaAsset>("/api/admin/media", {
    method: "POST",
    body: formData,
  });
}
