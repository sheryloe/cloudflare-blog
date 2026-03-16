export type PostStatus = "draft" | "published" | "archived";

export interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Tag {
  id: string;
  slug: string;
  name: string;
}

export interface Series {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
}

export interface MediaAsset {
  id: string;
  path: string;
  url: string;
  mimeType: string;
  size: number;
  altText?: string | null;
  createdAt: string;
}

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  coverImage?: string | null;
  status: PostStatus;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Post extends PostSummary {
  content: string;
  category?: Category | null;
  tags: Tag[];
  youtubeUrl?: string | null;
}

export interface CreatePostInput {
  title: string;
  subtitle?: string | null;
  slug?: string;
  excerpt?: string | null;
  content: string;
  categoryId?: string | null;
  tagIds?: string[];
  coverImage?: string | null;
  youtubeUrl?: string | null;
  status?: PostStatus;
  publishedAt?: string | null;
}

export type UpdatePostInput = Partial<CreatePostInput>;

export interface TaxonomyInput {
  name: string;
  slug?: string;
  description?: string | null;
}

export interface SessionUser {
  email: string;
}

export interface AdminSession {
  authenticated: boolean;
  user: SessionUser | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CategoryFeed {
  category: Category;
  posts: PostSummary[];
}

export interface TagFeed {
  tag: Tag;
  posts: PostSummary[];
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
