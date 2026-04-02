export type PostStatus = "draft" | "published" | "archived";

export interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Tag {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  publishedCount?: number;
  latestPublishedAt?: string | null;
  topPostTitle?: string | null;
  indexCandidate?: boolean;
  qualityIssues?: TagQualityIssue[];
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

export interface RelatedLink {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  siteName?: string | null;
}

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  contentLead?: string | null;
  coverImage?: string | null;
  coverAlt?: string | null;
  category?: Category | null;
  status: PostStatus;
  viewCount?: number;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Post extends PostSummary {
  content: string;
  category?: Category | null;
  tags: Tag[];
  youtubeUrl?: string | null;
  relatedLinks: RelatedLink[];
}

export interface CreatePostInput {
  title: string;
  subtitle?: string | null;
  slug?: string;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  content: string;
  categoryId?: string | null;
  tagIds?: string[];
  tagNames?: string[];
  coverImage?: string | null;
  coverAlt?: string | null;
  youtubeUrl?: string | null;
  relatedLinks?: RelatedLink[];
  status?: PostStatus;
  publishedAt?: string | null;
}

export type UpdatePostInput = Partial<CreatePostInput>;

export interface UpsertPostBySlugInput extends Omit<CreatePostInput, "slug"> {
  slug: string;
}

export interface UpsertPostBySlugResult {
  operation: "created" | "updated";
  post: Post;
}

export interface BloggerCompatPostInput {
  title: string;
  content: string;
  slug?: string;
  description?: string | null;
  summary?: string | null;
  labels?: string[];
  tagNames?: string[];
  status?: PostStatus;
  isDraft?: boolean;
  publishedAt?: string | null;
  category?: string | null;
  categoryId?: string | null;
}

export interface BloggerCompatListItem {
  kind: "blogger#post";
  id: string;
  title: string;
  content: string;
  summary: string | null;
  description: string | null;
  labels: string[];
  status: PostStatus;
  published: string | null;
  updated: string;
  url: string;
  selfLink: string;
}

export interface BloggerCompatListResponse {
  kind: "blogger#postList";
  items: BloggerCompatListItem[];
  nextPageToken?: string;
}

export interface BloggerCompatOperationResult {
  operation: "created" | "updated";
  post: Post;
}

export interface TaxonomyInput {
  name: string;
  slug?: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  parentId?: string | null;
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
  featuredPost?: PostSummary | null;
}

export type TagQualityIssue = "missing-description" | "missing-seo-description" | "insufficient-posts";

type TagQualityInput = Pick<Tag, "description" | "seoDescription" | "publishedCount">;

export function computeTagQualityIssues(input: TagQualityInput): TagQualityIssue[] {
  const issues: TagQualityIssue[] = [];
  const publishedCount = Number(input.publishedCount ?? 0);

  if (!(input.description ?? "").trim()) {
    issues.push("missing-description");
  }

  if (!(input.seoDescription ?? "").trim()) {
    issues.push("missing-seo-description");
  }

  if (publishedCount < 3) {
    issues.push("insufficient-posts");
  }

  return issues;
}

export function computeTagIndexCandidate(input: TagQualityInput) {
  return computeTagQualityIssues(input).length === 0;
}

export interface SearchPostsResult {
  query: string;
  posts: PostSummary[];
}

export interface RecordPostViewResult {
  slug: string;
  viewCount: number;
}

export interface SiteBrandingSettings {
  siteTitle: string;
  siteAltName: string;
  siteAuthor: string;
  siteTagline: string;
  siteDescription: string;
}

export interface SiteSidebarSettings {
  title: string;
  description: string;
}

export interface SiteHomeSettings {
  eyebrow: string;
  title: string;
  description: string;
  featuredTitle: string;
  featuredDescription: string;
  latestTitle: string;
  latestDescription: string;
}

export interface SiteSearchSettings {
  eyebrow: string;
  title: string;
  description: string;
  placeholder: string;
}

export interface SiteAboutSettings {
  eyebrow: string;
  title: string;
  description: string;
  featureTitle: string;
  featureDescription: string;
  categoriesTitle: string;
  categoriesDescription: string;
}

export interface SiteSettings {
  branding: SiteBrandingSettings;
  sidebar: SiteSidebarSettings;
  home: SiteHomeSettings;
  search: SiteSearchSettings;
  about: SiteAboutSettings;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  branding: {
    siteTitle: "동그리의 기록소",
    siteAltName: "동그리 아카이브",
    siteAuthor: "동그리",
    siteTagline: "기술과 세상, 일상의 결을 기록합니다.",
    siteDescription: "개발과 시장, 여행과 생활의 흐름을 차분히 기록하는 개인 아카이브입니다.",
  },
  sidebar: {
    title: "동그리의 기록에서 찾고 싶은 흐름을 정리합니다.",
    description: "짧은 메모와 긴 글을 함께 쌓아가며 오래 남는 아카이브를 만듭니다.",
  },
  home: {
    eyebrow: "동그리의 기록",
    title: "흐름을 모아, 한 문장씩 정리합니다.",
    description: "기술과 시장, 세상과 일상에서 남기고 싶은 장면을 차분히 기록합니다.",
    featuredTitle: "대표 글",
    featuredDescription: "지금 먼저 읽어볼 만한 기록을 골라 보여드립니다.",
    latestTitle: "최신 글",
    latestDescription: "가장 최근에 정리한 기록을 확인할 수 있습니다.",
  },
  search: {
    eyebrow: "검색",
    title: "기록을 빠르게 다시 찾기",
    description: "카테고리나 키워드로 필요한 글을 바로 찾을 수 있습니다.",
    placeholder: "기술, 시장, 여행, 일상",
  },
  about: {
    eyebrow: "소개",
    title: "동그리의 기록소는 어떤 곳인가요?",
    description: "개발과 생활, 시장과 세상의 흐름을 한 곳에 모으는 개인 아카이브입니다.",
    featureTitle: "카테고리로 분류하고 맥락으로 읽기",
    featureDescription: "루트 카테고리와 하위 카테고리로 기록을 정리해 필요한 흐름을 빠르게 찾을 수 있게 구성합니다.",
    categoriesTitle: "카테고리로 둘러보기",
    categoriesDescription: "주제별로 나뉜 기록을 따라가며 관심 있는 글을 이어서 읽을 수 있습니다.",
  },
};

export function cloneSiteSettings(settings: SiteSettings = DEFAULT_SITE_SETTINGS): SiteSettings {
  return {
    branding: { ...settings.branding },
    sidebar: { ...settings.sidebar },
    home: { ...settings.home },
    search: { ...settings.search },
    about: { ...settings.about },
  };
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
