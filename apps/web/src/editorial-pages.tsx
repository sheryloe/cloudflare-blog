import {
  DEFAULT_SITE_SETTINGS,
  type Category,
  type CategoryFeed,
  type Post,
  type PostSummary,
  type SiteSettings,
  type TagFeed,
  cloneSiteSettings,
  computeTagIndexCandidate,
} from "@cloudflare-blog/shared";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Menu,
  Moon,
  Rss,
  Search,
  Sun,
  X,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { AnalyticsTracker } from "./components/analytics-tracker";
import { MarkdownContent } from "./components/markdown-content";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  getCategoryFeed,
  getPost,
  getSiteSettings,
  getTagFeed,
  getWorkerResourceUrl,
  listCategories,
  listPosts,
  listTopPosts,
  recordPostView,
  searchPosts,
} from "./lib/api";
import {
  buildExcerpt,
  createBlogPostingStructuredData,
  createCollectionPageStructuredData,
  createWebPageStructuredData,
  createWebSiteStructuredData,
  type PageMetadataInput,
  useSeoMetadata,
} from "./lib/seo";
import { cn } from "./lib/utils";
import { ErrorMessage } from "./ui";

const KO_BASE_PATH = "/ko";
const THEME_STORAGE_KEY = "dongri-theme-mode";
const RSS_FEED_URL = `${KO_BASE_PATH}/rss.xml`;
const FEED_XML_URL = `${KO_BASE_PATH}/feed.xml`;
const SITEMAP_URL = `${KO_BASE_PATH}/sitemap.xml`;
const DEFAULT_OG_IMAGE_PATH = "/og-default.svg";
const FALLBACK_COVER_IMAGES = [
  "/images/editorial-cover-01.svg",
  "/images/editorial-cover-02.svg",
  "/images/editorial-cover-03.svg",
  "/images/editorial-cover-04.svg",
  "/images/editorial-cover-05.svg",
  "/images/editorial-cover-06.svg",
  "/images/editorial-cover-07.svg",
  "/images/editorial-cover-08.svg",
] as const;

const SiteSettingsContext = createContext<SiteSettings>(DEFAULT_SITE_SETTINGS);
const CategoriesContext = createContext<Category[]>([]);

type ThemeMode = "light" | "dark";

type RootDescriptor = {
  slug: string;
  name: string;
  eyebrow: string;
  description: string;
  tone: "personal" | "tech" | "market" | "world" | "field";
};

const ROOT_CATEGORY_ORDER = ["동그리의-기록", "세상의-기록", "시장의-기록", "신기술과-도구", "정보의-기록"] as const;

const ROOT_CATEGORY_DESCRIPTORS: Record<(typeof ROOT_CATEGORY_ORDER)[number], RootDescriptor> = {
  "동그리의-기록": {
    slug: "동그리의-기록",
    name: "동그리의 기록",
    eyebrow: "개인의 기록",
    description: "개발과 여행, 일상에서 건져 올린 장면을 개인 아카이브로 기록합니다.",
    tone: "personal",
  },
  "세상의-기록": {
    slug: "세상의-기록",
    name: "세상의 기록",
    eyebrow: "세상의 기록",
    description: "시사와 미스터리, 해설을 더 넓은 시선으로 읽어냅니다.",
    tone: "world",
  },
  "시장의-기록": {
    slug: "시장의-기록",
    name: "시장의 기록",
    eyebrow: "시장의 흐름",
    description: "주식과 크립토의 흐름을 숫자보다 맥락 중심으로 읽어냅니다.",
    tone: "market",
  },
  "신기술과-도구": {
    slug: "신기술과-도구",
    name: "신기술과 도구",
    eyebrow: "도구와 분석",
    description: "삶에 닿는 기술과 정보, 도구와 활용을 차분하게 정리합니다.",
    tone: "tech",
  },
  "정보의-기록": {
    slug: "정보의-기록",
    name: "정보의 기록",
    eyebrow: "현장의 기록",
    description: "문화와 공간, 축제와 현장의 결을 아카이브처럼 모읍니다.",
    tone: "field",
  },
};

const LEGACY_CATEGORY_SLUG_MAP: Record<string, string> = {
  "유용한-기술": "삶을-유용하게",
  "유용한-정보": "삶을-유용하게",
  "미스터리와-전설": "미스테리아-스토리",
  "역사와-문화": "미스테리아-스토리",
  "이슈와-해설": "동그리의-생각",
  "축제와-시즌": "축제와-현장",
  "행사와-현장": "축제와-현장",
};

const pageDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

type GiscusRuntimeConfig = {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  mapping: string;
  theme: string;
};

function getSystemTheme() {
  if (typeof window === "undefined") {
    return "light" as const;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getSavedTheme() {
  if (typeof window === "undefined") {
    return null;
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "dark" || saved === "light" ? saved : null;
}

function resolveInitialTheme(): ThemeMode {
  return getSavedTheme() ?? getSystemTheme();
}

function applyThemeMode(themeMode: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-theme", themeMode);
}

function resolveGiscusConfig(): GiscusRuntimeConfig | null {
  const repo = import.meta.env.VITE_GISCUS_REPO?.trim() ?? "";
  const repoId = import.meta.env.VITE_GISCUS_REPO_ID?.trim() ?? "";
  const category = import.meta.env.VITE_GISCUS_CATEGORY?.trim() ?? "";
  const categoryId = import.meta.env.VITE_GISCUS_CATEGORY_ID?.trim() ?? "";
  const mapping = import.meta.env.VITE_GISCUS_MAPPING?.trim() || "pathname";
  const theme = import.meta.env.VITE_GISCUS_THEME?.trim() || "light";

  if (!repo || !repoId || !category || !categoryId) {
    return null;
  }

  return {
    repo,
    repoId,
    category,
    categoryId,
    mapping,
    theme,
  };
}

function withKoPath(path: string) {
  if (path === "/") {
    return `${KO_BASE_PATH}/`;
  }

  return `${KO_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

function useSiteSettings() {
  return useContext(SiteSettingsContext);
}

function useCategories() {
  return useContext(CategoriesContext);
}

function usePageMetadata(metadata: PageMetadataInput) {
  useSeoMetadata(metadata);
}

function decodeSlugParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatDate(value?: string | null) {
  if (!value) {
    return "날짜 미정";
  }

  return pageDateFormatter.format(new Date(value));
}

function estimateReadMinutes(content: string) {
  const words = content
    .replace(/[#>*_`~[\]()!-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 220));
}

function getPostSummary(post: Pick<PostSummary, "excerpt" | "subtitle" | "contentLead" | "category">) {
  return (
    post.excerpt?.trim() ||
    post.subtitle?.trim() ||
    post.contentLead?.trim() ||
    `${post.category?.name ?? "기록"}의 흐름과 맥락을 정리한 글입니다.`
  );
}

function getPostDateLabel(post: Pick<PostSummary, "publishedAt" | "updatedAt" | "createdAt">) {
  return formatDate(post.publishedAt ?? post.updatedAt ?? post.createdAt);
}

function getTagMetaTitle(tagName: string | undefined, siteTitle: string, seoTitle?: string | null) {
  return seoTitle?.trim() || `${tagName?.trim() || "태그"} 관련 글 모음 | ${siteTitle}`;
}

function getTagMetaDescription(tag?: TagFeed["tag"] | null) {
  if (!tag) {
    return "태그별로 공개 글을 모아보는 페이지입니다.";
  }

  return tag.seoDescription?.trim() || tag.description?.trim() || `${tag.name}와 연결된 공개 글을 모아보는 페이지입니다.`;
}

function findCategoryBySlug(categories: Category[], slug: string) {
  const effectiveSlug = LEGACY_CATEGORY_SLUG_MAP[slug] ?? slug;
  return categories.find((category) => category.slug === effectiveSlug) ?? null;
}

function sortCategoriesForDisplay(categories: Category[]) {
  return [...categories].sort((left, right) => {
    const leftIndex = ROOT_CATEGORY_ORDER.indexOf(left.slug as (typeof ROOT_CATEGORY_ORDER)[number]);
    const rightIndex = ROOT_CATEGORY_ORDER.indexOf(right.slug as (typeof ROOT_CATEGORY_ORDER)[number]);
    const leftRank = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const rightRank = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.name.localeCompare(right.name, "ko");
  });
}

function getRootCategories(categories: Category[]) {
  return sortCategoriesForDisplay(categories.filter((category) => !category.parentId));
}

function getCanonicalCategory(category: Category | null | undefined, categories: Category[]) {
  if (!category) {
    return null;
  }

  return categories.find((item) => item.id === category.id || item.slug === category.slug) ?? category;
}

function resolveParentCategory(category: Category | null | undefined, categories: Category[]) {
  const currentCategory = getCanonicalCategory(category, categories);

  if (!currentCategory?.parentId) {
    return null;
  }

  return categories.find((item) => item.id === currentCategory.parentId) ?? null;
}

function resolveRootCategory(category: Category | null | undefined, categories: Category[]) {
  let currentCategory = getCanonicalCategory(category, categories);

  if (!currentCategory) {
    return null;
  }

  let parentCategory = resolveParentCategory(currentCategory, categories);

  while (parentCategory) {
    currentCategory = parentCategory;
    parentCategory = resolveParentCategory(currentCategory, categories);
  }

  return currentCategory;
}

function buildCategoryLabel(category: Category | null | undefined, categories: Category[], showParent = true) {
  if (!category) {
    return "아카이브";
  }

  const parent = resolveParentCategory(category, categories);

  if (!parent || !showParent) {
    return category.name;
  }

  return `${parent.name} / ${category.name}`;
}

function getRootDescriptor(slug?: string | null) {
  if (!slug) {
    return null;
  }

  return ROOT_CATEGORY_DESCRIPTORS[slug as (typeof ROOT_CATEGORY_ORDER)[number]] ?? null;
}

function getRootNavigationItems(categories: Category[]) {
  const roots = getRootCategories(categories);

  if (roots.length) {
    return roots;
  }

  return ROOT_CATEGORY_ORDER.map((slug) => {
    const descriptor = ROOT_CATEGORY_DESCRIPTORS[slug];

    return {
      id: `fallback-${slug}`,
      slug,
      name: descriptor.name,
      description: descriptor.description,
      parentId: null,
    } satisfies Category;
  });
}

function getChildCategories(parentId: string, categories: Category[]) {
  return [...categories]
    .filter((category) => category.parentId === parentId)
    .sort((left, right) => left.name.localeCompare(right.name, "ko"));
}

function resolveRootChildCategory(category: Category | null | undefined, rootCategory: Category, categories: Category[]) {
  let currentCategory = getCanonicalCategory(category, categories);

  if (!currentCategory || currentCategory.id === rootCategory.id) {
    return null;
  }

  let parentCategory = resolveParentCategory(currentCategory, categories);

  while (parentCategory && parentCategory.id !== rootCategory.id) {
    currentCategory = parentCategory;
    parentCategory = resolveParentCategory(currentCategory, categories);
  }

  return parentCategory?.id === rootCategory.id ? currentCategory : null;
}

function postBelongsToRoot(post: PostSummary, root: Category, categories: Category[]) {
  const postRoot = resolveRootCategory(post.category ?? null, categories);
  return postRoot?.id === root.id;
}

function getCurrentRootSlug(pathname: string, categories: Category[]) {
  const prefix = `${KO_BASE_PATH}/category/`;

  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const slug = decodeSlugParam(pathname.slice(prefix.length));
  const category = findCategoryBySlug(categories, slug);
  return resolveRootCategory(category, categories)?.slug ?? null;
}

function hashSeed(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function getFallbackCoverImage(post: { slug?: string | null; title: string }) {
  const seed = post.slug?.trim() || post.title;
  const index = hashSeed(seed) % FALLBACK_COVER_IMAGES.length;
  return FALLBACK_COVER_IMAGES[index];
}

function CoverImage(props: {
  post: Pick<PostSummary, "coverImage" | "coverAlt" | "title" | "slug">;
  className?: string;
  priority?: "high" | "low";
}) {
  const fetchPriority = props.priority === "high" ? "high" : undefined;

  return (
    <img
      className={cn("cover-image", props.className)}
      src={props.post.coverImage ?? getFallbackCoverImage(props.post)}
      alt={props.post.coverAlt || props.post.title}
      loading={props.priority === "high" ? "eager" : "lazy"}
      decoding="async"
      {...(fetchPriority ? ({ fetchpriority: fetchPriority } as Record<string, string>) : {})}
    />
  );
}

function ThemeToggleButton(props: { themeMode: ThemeMode; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={props.themeMode === "light" ? "다크 모드로 전환" : "라이트 모드로 전환"}
      onClick={props.onToggle}
    >
      {props.themeMode === "light" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}

function SearchForm(props: {
  className?: string;
  compact?: boolean;
  placeholder?: string;
  onComplete?: () => void;
  initialValue?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [value, setValue] = useState(props.initialValue ?? "");

  useEffect(() => {
    if (props.initialValue !== undefined) {
      setValue(props.initialValue);
      return;
    }

    if (location.pathname === withKoPath("/search")) {
      const query = new URLSearchParams(location.search).get("q") ?? "";
      setValue(query);
    }
  }, [location.pathname, location.search, props.initialValue]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextValue = value.trim();

    if (nextValue) {
      navigate(`${withKoPath("/search")}?q=${encodeURIComponent(nextValue)}`);
    } else {
      navigate(withKoPath("/search"));
    }

    props.onComplete?.();
  };

  return (
    <form className={cn("editorial-search", props.compact && "editorial-search--compact", props.className)} onSubmit={handleSubmit}>
      <Search className="editorial-search__icon" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={props.placeholder ?? "기록을 검색해보세요"}
        className="editorial-search__input"
      />
    </form>
  );
}

function CategoryPill(props: {
  category?: Category | null;
  showParent?: boolean;
  className?: string;
}) {
  const categories = useCategories();
  const label = buildCategoryLabel(props.category, categories, props.showParent ?? true);

  if (!props.category?.slug) {
    return <span className={cn("category-pill", props.className)}>{label}</span>;
  }

  return (
    <Link to={withKoPath(`/category/${props.category.slug}`)} className={cn("category-pill", props.className)}>
      {label}
    </Link>
  );
}

function BreadcrumbTrail(props: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="breadcrumb-trail" aria-label="breadcrumb">
      {props.items.map((item, index) => {
        const isLast = index === props.items.length - 1;
        const key = `${item.label}-${index}`;

        return (
          <span key={key} className="breadcrumb-trail__item">
            {item.href && !isLast ? (
              <Link to={item.href} className="breadcrumb-trail__link">
                {item.label}
              </Link>
            ) : (
              <span className="breadcrumb-trail__current">{item.label}</span>
            )}
            {!isLast ? <ChevronRight className="breadcrumb-trail__divider" /> : null}
          </span>
        );
      })}
    </nav>
  );
}

function SectionHeader(props: {
  eyebrow: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="section-header">
      <div className="section-header__copy">
        <p className="section-header__eyebrow">{props.eyebrow}</p>
        <h2 className="section-header__title">{props.title}</h2>
        {props.description ? <p className="section-header__description">{props.description}</p> : null}
      </div>
      {props.actionHref && props.actionLabel ? (
        <Link to={props.actionHref} className="section-header__action">
          <span>{props.actionLabel}</span>
          <ArrowUpRight size={16} />
        </Link>
      ) : null}
    </div>
  );
}

function StoryFeatureCard(props: {
  post: PostSummary;
  tone?: RootDescriptor["tone"];
  className?: string;
}) {
  const summary = getPostSummary(props.post);

  return (
    <article className={cn("story-feature-card", props.className)} data-tone={props.tone ?? "tech"}>
      <Link to={withKoPath(`/post/${props.post.slug}`)} className="story-feature-card__media">
        <CoverImage post={props.post} />
      </Link>
      <div className="story-feature-card__body">
        <div className="story-feature-card__meta">
          <CategoryPill category={props.post.category} />
          <span>{getPostDateLabel(props.post)}</span>
          {typeof props.post.viewCount === "number" ? <span>조회 {props.post.viewCount}</span> : null}
        </div>
        <h3 className="story-feature-card__title">
          <Link to={withKoPath(`/post/${props.post.slug}`)}>{props.post.title}</Link>
        </h3>
        <p className="story-feature-card__summary">{summary}</p>
        <Link to={withKoPath(`/post/${props.post.slug}`)} className="story-feature-card__link">
          <span>계속 읽기</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}

function StoryStackCard(props: {
  post: PostSummary;
  className?: string;
  compact?: boolean;
}) {
  const summary = getPostSummary(props.post);

  return (
    <article className={cn("story-stack-card", props.compact && "story-stack-card--compact", props.className)}>
      <div className="story-stack-card__copy">
        <div className="story-stack-card__meta">
          <CategoryPill category={props.post.category} showParent={false} />
          <span>{getPostDateLabel(props.post)}</span>
        </div>
        <h3 className="story-stack-card__title">
          <Link to={withKoPath(`/post/${props.post.slug}`)}>{props.post.title}</Link>
        </h3>
        <p className="story-stack-card__summary">{summary}</p>
      </div>
      <Link to={withKoPath(`/post/${props.post.slug}`)} className="story-stack-card__media">
        <CoverImage post={props.post} />
      </Link>
    </article>
  );
}

function StoryListItem(props: {
  post: PostSummary;
  className?: string;
  showImage?: boolean;
}) {
  const summary = getPostSummary(props.post);

  return (
    <article className={cn("story-list-item", props.className)}>
      <div className="story-list-item__copy">
        <div className="story-list-item__meta">
          <CategoryPill category={props.post.category} />
          <span>{getPostDateLabel(props.post)}</span>
          {typeof props.post.viewCount === "number" ? <span>조회 {props.post.viewCount}</span> : null}
        </div>
        <h3 className="story-list-item__title">
          <Link to={withKoPath(`/post/${props.post.slug}`)}>{props.post.title}</Link>
        </h3>
        <p className="story-list-item__summary">{summary}</p>
      </div>
      {props.showImage !== false ? (
        <Link to={withKoPath(`/post/${props.post.slug}`)} className="story-list-item__media">
          <CoverImage post={props.post} />
        </Link>
      ) : null}
    </article>
  );
}

function StoryMiniItem(props: { post: PostSummary }) {
  return (
    <article className="story-mini-item">
      <Link to={withKoPath(`/post/${props.post.slug}`)} className="story-mini-item__media">
        <CoverImage post={props.post} />
      </Link>
      <div className="story-mini-item__copy">
        <h3 className="story-mini-item__title">
          <Link to={withKoPath(`/post/${props.post.slug}`)}>{props.post.title}</Link>
        </h3>
        <p className="story-mini-item__date">{getPostDateLabel(props.post)}</p>
      </div>
    </article>
  );
}

function StoryGridCard(props: { post: PostSummary; className?: string }) {
  const summary = getPostSummary(props.post);

  return (
    <article className={cn("story-grid-card", props.className)}>
      <Link to={withKoPath(`/post/${props.post.slug}`)} className="story-grid-card__media">
        <CoverImage post={props.post} />
      </Link>
      <div className="story-grid-card__body">
        <div className="story-grid-card__meta">
          <CategoryPill category={props.post.category} showParent={false} />
          <span>{getPostDateLabel(props.post)}</span>
        </div>
        <h3 className="story-grid-card__title">
          <Link to={withKoPath(`/post/${props.post.slug}`)}>{props.post.title}</Link>
        </h3>
        <p className="story-grid-card__summary">{summary}</p>
      </div>
    </article>
  );
}

function TopChronicleLink(props: { post: PostSummary }) {
  return (
    <Link to={withKoPath(`/post/${props.post.slug}`)} className="top-chronicle-link">
      <span className="top-chronicle-link__label">{props.post.category?.name ?? "기록"}</span>
      <h4 className="top-chronicle-link__title">{props.post.title}</h4>
    </Link>
  );
}

function LoadingStoryFeatureCard() {
  return (
    <article className="story-feature-card story-feature-card--loading" aria-hidden="true">
      <div className="story-feature-card__media loading-surface loading-surface--media" />
      <div className="story-feature-card__body">
        <div className="story-feature-card__meta">
          <span className="loading-surface loading-surface--pill" />
          <span className="loading-surface loading-surface--meta" />
          <span className="loading-surface loading-surface--meta loading-surface--meta-short" />
        </div>
        <span className="loading-surface loading-surface--title-lg" />
        <span className="loading-surface loading-surface--title-md" />
        <span className="loading-surface loading-surface--summary-lg" />
        <span className="loading-surface loading-surface--summary-md" />
      </div>
    </article>
  );
}

function LoadingStoryGridCard() {
  return (
    <article className="story-grid-card story-grid-card--loading" aria-hidden="true">
      <div className="story-grid-card__media loading-surface loading-surface--media" />
      <div className="story-grid-card__body">
        <div className="story-grid-card__meta">
          <span className="loading-surface loading-surface--pill" />
          <span className="loading-surface loading-surface--meta" />
        </div>
        <span className="loading-surface loading-surface--title-md" />
        <span className="loading-surface loading-surface--summary-md" />
      </div>
    </article>
  );
}

function LoadingStoryListItem() {
  return (
    <article className="story-list-item story-list-item--loading" aria-hidden="true">
      <div className="story-list-item__copy">
        <div className="story-list-item__meta">
          <span className="loading-surface loading-surface--pill" />
          <span className="loading-surface loading-surface--meta" />
          <span className="loading-surface loading-surface--meta loading-surface--meta-short" />
        </div>
        <span className="loading-surface loading-surface--title-md" />
        <span className="loading-surface loading-surface--summary-lg" />
        <span className="loading-surface loading-surface--summary-md" />
      </div>
      <div className="story-list-item__media loading-surface loading-surface--media" />
    </article>
  );
}

function HomePageLoadingState(props: { siteTitle: string; eyebrow: string }) {
  return (
    <div className="editorial-page" aria-busy="true" aria-live="polite">
      <section className="home-hero home-hero--stitch page-loading-shell">
        <div className="home-hero-split">
          <div className="home-hero-split__media loading-surface loading-surface--media" />
          <div className="home-hero-split__copy">
            <div className="home-hero-split__meta">
              <span className="loading-surface loading-surface--pill" />
              <span className="loading-surface loading-surface--meta" />
            </div>
            <p className="section-header__eyebrow">{props.eyebrow}</p>
            <span className="loading-surface loading-surface--title-xl" />
            <span className="loading-surface loading-surface--title-lg" />
            <span className="loading-surface loading-surface--summary-lg" />
            <span className="loading-surface loading-surface--summary-md" />
            <span className="loading-surface loading-surface--cta" />
          </div>
        </div>

        <div className="home-curated">
          <SectionHeader eyebrow="추천 글" title="지금 읽기 좋은 글" />
          <div className="home-curated__grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <LoadingStoryGridCard key={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="home-root-grid">
        {Array.from({ length: 3 }).map((_, index) => (
          <section key={index} className="home-root-section page-loading-shell">
            <div className="home-root-section__head">
              <div>
                <p className="section-header__eyebrow">{props.siteTitle}</p>
                <span className="loading-surface loading-surface--title-md" />
              </div>
            </div>
            <div className="home-root-section__grid">
              <LoadingStoryFeatureCard />
              <div className="home-root-section__rail">
                <LoadingStoryListItem />
                <LoadingStoryListItem />
              </div>
            </div>
          </section>
        ))}
      </section>
    </div>
  );
}

function ArchivePageLoadingState(props: {
  siteTitle: string;
  eyebrow: string;
  title: string;
  description: string;
  chipLabels?: string[];
}) {
  return (
    <div className="editorial-page" aria-busy="true" aria-live="polite">
      <BreadcrumbTrail
        items={[
          { label: props.siteTitle, href: withKoPath("/") },
          { label: props.title },
        ]}
      />

      <section className="page-hero page-hero--archive page-loading-shell">
        <div className="page-hero__copy">
          <p className="section-header__eyebrow">{props.eyebrow}</p>
          <h1 className="page-hero__title">{props.title}</h1>
          <p className="page-hero__description">{props.description}</p>
          {props.chipLabels?.length ? (
            <div className="chip-row">
              {props.chipLabels.slice(0, 5).map((label) => (
                <span key={label} className="category-pill category-pill--ghost">
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="archive-lead archive-lead--category">
        <div className="archive-lead__grid">
          <LoadingStoryFeatureCard />
          <aside className="archive-lead__rail">
            <div className="detail-panel page-loading-shell">
              <p className="section-header__eyebrow">큐레이터 노트</p>
              <span className="loading-surface loading-surface--summary-lg" />
              <span className="loading-surface loading-surface--summary-md" />
            </div>
            <div className="detail-panel page-loading-shell">
              <SectionHeader eyebrow="주요 글" title="카테고리 주요 글" />
              <div className="top-chronicle-list">
                {Array.from({ length: 3 }).map((_, index) => (
                  <span key={index} className="loading-surface loading-surface--summary-md" />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="editorial-section">
        <div className="category-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingStoryGridCard key={index} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SearchResultsLoadingState(props: { query: string }) {
  return (
    <>
      <section className="archive-lead">
        <div className="archive-lead__grid archive-lead__grid--single">
          <LoadingStoryFeatureCard />
        </div>
      </section>

      <section className="editorial-section">
        <SectionHeader eyebrow="검색 중" title={`"${props.query}" 결과를 모으는 중입니다.`} description="공개 글에서 관련 기록을 찾고 있습니다." />
        <div className="story-list">
          {Array.from({ length: 4 }).map((_, index) => (
            <LoadingStoryListItem key={index} />
          ))}
        </div>
      </section>
    </>
  );
}

function RootSection(props: {
  root: Category;
  posts: PostSummary[];
}) {
  const descriptor = getRootDescriptor(props.root.slug);
  const sectionPosts = props.posts.slice(0, 2);

  if (!sectionPosts.length) {
    return null;
  }

  return (
    <section className="home-root-section">
      <div className="home-root-section__head">
        <div>
          <p className="section-header__eyebrow">{descriptor?.eyebrow ?? "기록 아카이브"}</p>
          <h2 className="home-root-section__title">{props.root.name}</h2>
        </div>
        <Link to={withKoPath(`/category/${props.root.slug}`)} className="home-root-section__link">
          전체 보기
        </Link>
      </div>
      <div className="home-root-section__list">
        {sectionPosts.map((post) => (
          <StoryMiniItem key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}

function FeedCallout() {
  return (
    <section className="feed-callout">
      <div className="feed-callout__copy">
        <p className="section-header__eyebrow">아카이브 도구</p>
        <h2 className="feed-callout__title">읽는 흐름을 한 번에 이어가기</h2>
        <p className="feed-callout__description">
          RSS, 피드, 사이트맵으로 기록의 축을 바로 따라가며 읽을 수 있습니다.
        </p>
      </div>
      <div className="feed-callout__actions">
        <a href={RSS_FEED_URL} className="feed-callout__link">
          <Rss size={16} />
          <span>RSS</span>
        </a>
        <a href={FEED_XML_URL} className="feed-callout__link">
          <ArrowUpRight size={16} />
          <span>피드 XML</span>
        </a>
        <a href={SITEMAP_URL} className="feed-callout__link">
          <ArrowUpRight size={16} />
          <span>사이트맵</span>
        </a>
        <Link to={withKoPath("/search")} className="feed-callout__link">
          <Search size={16} />
          <span>검색으로 이동</span>
        </Link>
      </div>
    </section>
  );
}

function VideoEmbed(props: { title: string; youtubeUrl: string }) {
  const videoId = useMemo(() => {
    try {
      const url = new URL(props.youtubeUrl);
      const hostname = url.hostname.replace(/^www\./, "");

      if (hostname === "youtu.be") {
        return url.pathname.slice(1) || null;
      }

      if (hostname === "youtube.com" || hostname === "m.youtube.com") {
        if (url.pathname === "/watch") {
          return url.searchParams.get("v");
        }

        if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
          return url.pathname.split("/").at(-1) ?? null;
        }
      }

      return null;
    } catch {
      return null;
    }
  }, [props.youtubeUrl]);

  if (!videoId) {
    return null;
  }

  return (
    <section className="detail-panel">
      <p className="section-header__eyebrow">Video Note</p>
      <div className="video-box">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={`${props.title} video`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </section>
  );
}

function PostComments(props: { slug: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const giscusConfig = useMemo(() => resolveGiscusConfig(), []);

  useEffect(() => {
    if (!hostRef.current || !giscusConfig) {
      return;
    }

    hostRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-repo", giscusConfig.repo);
    script.setAttribute("data-repo-id", giscusConfig.repoId);
    script.setAttribute("data-category", giscusConfig.category);
    script.setAttribute("data-category-id", giscusConfig.categoryId);
    script.setAttribute("data-mapping", giscusConfig.mapping);
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    script.setAttribute("data-theme", giscusConfig.theme);
    script.setAttribute("data-lang", "ko");
    script.setAttribute("data-loading", "lazy");

    if (giscusConfig.mapping === "specific") {
      script.setAttribute("data-term", props.slug);
    }

    hostRef.current.appendChild(script);
  }, [giscusConfig, props.slug]);

  if (!giscusConfig) {
    return null;
  }

  return (
    <section className="editorial-section">
      <SectionHeader
        eyebrow="대화"
        title="기록의 메모를 이어주세요"
        description="생각의 맥락이나 다른 시선을 덧붙일 수 있는 공간입니다."
      />
      <div className="detail-panel">
        <div ref={hostRef} />
      </div>
    </section>
  );
}

function EditorialFooter(props: { categories: Category[]; siteSettings: SiteSettings }) {
  const rootItems = getRootNavigationItems(props.categories);

  return (
    <footer className="editorial-footer">
      <div className="editorial-footer__grid">
        <div className="editorial-footer__brand">
          <Link to={withKoPath("/")} className="editorial-footer__title">
            {props.siteSettings.branding.siteTitle}
          </Link>
          <p className="editorial-footer__text">{props.siteSettings.branding.siteDescription}</p>
        </div>
        <div className="editorial-footer__group">
          <p className="editorial-footer__heading">바로가기</p>
          <Link to={withKoPath("/")} className="editorial-footer__link">
            홈
          </Link>
          <Link to={withKoPath("/about")} className="editorial-footer__link">
            소개
          </Link>
          <Link to={withKoPath("/search")} className="editorial-footer__link">
            검색
          </Link>
        </div>
        <div className="editorial-footer__group">
          <p className="editorial-footer__heading">정책</p>
          <Link to={withKoPath("/privacy")} className="editorial-footer__link">
            개인정보처리방침
          </Link>
          <Link to={withKoPath("/contact")} className="editorial-footer__link">
            문의
          </Link>
          <Link to={withKoPath("/terms")} className="editorial-footer__link">
            이용조건
          </Link>
          <Link to={withKoPath("/disclaimer")} className="editorial-footer__link">
            면책 고지
          </Link>
          <Link to={withKoPath("/editorial-policy")} className="editorial-footer__link">
            편집 정책
          </Link>
        </div>
        <div className="editorial-footer__group">
          <p className="editorial-footer__heading">카테고리</p>
          {rootItems.map((item) => (
            <Link key={item.slug} to={withKoPath(`/category/${item.slug}`)} className="editorial-footer__link">
              {item.name}
            </Link>
          ))}
        </div>
        <div className="editorial-footer__group">
          <p className="editorial-footer__heading">피드</p>
          <a href={RSS_FEED_URL} className="editorial-footer__link">
            RSS
          </a>
          <a href={FEED_XML_URL} className="editorial-footer__link">
            피드 XML
          </a>
          <a href={SITEMAP_URL} className="editorial-footer__link">
            사이트맵
          </a>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const location = useLocation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(cloneSiteSettings());
  const [themeMode, setThemeMode] = useState<ThemeMode>(resolveInitialTheme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDesktopRootSlug, setActiveDesktopRootSlug] = useState<string | null>(null);
  const [expandedMobileRootSlug, setExpandedMobileRootSlug] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([listCategories(), getSiteSettings()])
      .then(([categoryItems, nextSiteSettings]) => {
        setCategories(categoryItems);
        setSiteSettings(cloneSiteSettings(nextSiteSettings));
      })
      .catch(() => {
        setCategories([]);
        setSiteSettings(cloneSiteSettings());
      });
  }, []);

  useEffect(() => {
    applyThemeMode(themeMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setActiveDesktopRootSlug(null);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = mobileMenuOpen ? "hidden" : previousOverflow;

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  const rootItems = useMemo(() => getRootNavigationItems(categories), [categories]);
  const currentRootSlug = useMemo(() => getCurrentRootSlug(location.pathname, categories), [location.pathname, categories]);
  const currentCategory = useMemo(() => {
    const prefixes = [`${KO_BASE_PATH}/category/`, `${KO_BASE_PATH}/category-preview/`];
    const matchedPrefix = prefixes.find((prefix) => location.pathname.startsWith(prefix));

    if (!matchedPrefix) {
      return null;
    }

    return findCategoryBySlug(categories, decodeURIComponent(location.pathname.slice(matchedPrefix.length)));
  }, [categories, location.pathname]);
  const rootNavItems = useMemo(
    () =>
      rootItems.map((item) => ({
        item,
        children: getChildCategories(item.id, categories),
      })),
    [categories, rootItems],
  );

  useEffect(() => {
    if (!mobileMenuOpen) {
      setExpandedMobileRootSlug(null);
      return;
    }

    setExpandedMobileRootSlug(currentRootSlug);
  }, [currentRootSlug, mobileMenuOpen]);

  useEffect(() => {
    if (!activeDesktopRootSlug || typeof document === "undefined") {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest("[data-root-nav-item='true']")) {
        return;
      }

      setActiveDesktopRootSlug(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDesktopRootSlug(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDesktopRootSlug]);

  return (
    <SiteSettingsContext.Provider value={siteSettings}>
      <CategoriesContext.Provider value={categories}>
        <div className="editorial-shell">
          <AnalyticsTracker />

          <header className="editorial-header">
            <div className="editorial-header__bar">
              <div className="editorial-header__brand">
                <Link to={withKoPath("/")} className="editorial-brand__title">
                  {siteSettings.branding.siteTitle}
                </Link>
                <p className="editorial-brand__tagline">{siteSettings.branding.siteTagline}</p>
              </div>

              <nav className="editorial-nav" aria-label="primary">
                {rootNavItems.map(({ item, children }) => {
                  const isRootActive = currentRootSlug === item.slug;
                  const isPopoverOpen = activeDesktopRootSlug === item.slug;
                  const isRootPage = currentCategory?.id === item.id || currentCategory?.slug === item.slug;
                  const popoverId = `editorial-nav-panel-${item.slug}`;

                  if (!children.length) {
                    return (
                      <Link
                        key={item.slug}
                        to={withKoPath(`/category/${item.slug}`)}
                        className={cn("editorial-nav__link", isRootActive && "editorial-nav__link--active")}
                      >
                        {item.name}
                      </Link>
                    );
                  }

                  return (
                    <div key={item.slug} className="editorial-nav__item" data-root-nav-item="true">
                      <button
                        type="button"
                        className={cn("editorial-nav__link", "editorial-nav__trigger", isRootActive && "editorial-nav__link--active")}
                        aria-expanded={isPopoverOpen}
                        aria-controls={popoverId}
                        onClick={() => setActiveDesktopRootSlug((current) => (current === item.slug ? null : item.slug))}
                      >
                        <span>{item.name}</span>
                        <ChevronRight size={14} className="editorial-nav__trigger-icon" />
                      </button>

                      {isPopoverOpen ? (
                        <div id={popoverId} className="editorial-nav-popover" aria-label={`${item.name} 하위 카테고리`}>
                          {children.map((child) => (
                            <Link
                              key={child.id}
                              to={withKoPath(`/category/${child.slug}`)}
                              className={cn(
                                "editorial-nav-popover__link",
                                currentCategory?.id === child.id && "editorial-nav-popover__link--active",
                              )}
                              onClick={() => setActiveDesktopRootSlug(null)}
                            >
                              <span>{child.name}</span>
                              <ChevronRight size={15} />
                            </Link>
                          ))}
                          <div className="editorial-nav-popover__divider" />
                          <Link
                            to={withKoPath(`/category/${item.slug}`)}
                            className={cn("editorial-nav-popover__link", isRootPage && "editorial-nav-popover__link--active")}
                            onClick={() => setActiveDesktopRootSlug(null)}
                          >
                            <span>전체 보기</span>
                            <ChevronRight size={15} />
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </nav>

              <div className="editorial-header__actions">
                <SearchForm className="editorial-header__search" compact placeholder="기록을 검색해보세요" />
                <Link to={withKoPath("/about")} className="editorial-utility-link">
                  소개
                </Link>
                <a href={RSS_FEED_URL} className="editorial-utility-link editorial-utility-link--icon" aria-label="RSS">
                  <Rss size={16} />
                </a>
                <ThemeToggleButton
                  themeMode={themeMode}
                  onToggle={() => setThemeMode((current) => (current === "light" ? "dark" : "light"))}
                />
                <button
                  type="button"
                  className="editorial-mobile-toggle"
                  aria-label={mobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
                  onClick={() => setMobileMenuOpen((current) => !current)}
                >
                  {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </div>
            </div>
          </header>

          {mobileMenuOpen ? (
            <div className="editorial-mobile-panel" role="dialog" aria-modal="true">
              <button type="button" className="editorial-mobile-panel__scrim" onClick={() => setMobileMenuOpen(false)} />
              <div className="editorial-mobile-panel__card">
                <div className="editorial-mobile-panel__head">
                  <div>
                    <p className="section-header__eyebrow">아카이브 메뉴</p>
                    <h2 className="section-header__title">카테고리로 이동</h2>
                  </div>
                  <button type="button" className="editorial-mobile-toggle" onClick={() => setMobileMenuOpen(false)}>
                    <X size={18} />
                  </button>
                </div>
                <SearchForm onComplete={() => setMobileMenuOpen(false)} />
                <div className="editorial-mobile-panel__links">
                  {rootNavItems.map(({ item, children }) => {
                    const isRootActive = currentRootSlug === item.slug;
                    const isExpanded = expandedMobileRootSlug === item.slug;
                    const isRootPage = currentCategory?.id === item.id || currentCategory?.slug === item.slug;
                    const sectionId = `editorial-mobile-root-${item.slug}`;

                    if (!children.length) {
                      return (
                        <Link
                          key={item.slug}
                          to={withKoPath(`/category/${item.slug}`)}
                          className={cn("editorial-mobile-panel__link", isRootActive && "editorial-mobile-panel__link--active")}
                        >
                          <span>{item.name}</span>
                          <ChevronRight size={16} />
                        </Link>
                      );
                    }

                    return (
                      <div key={item.slug} className="editorial-mobile-panel__section">
                        <button
                          type="button"
                          className={cn(
                            "editorial-mobile-panel__link",
                            "editorial-mobile-panel__section-trigger",
                            isRootActive && "editorial-mobile-panel__link--active",
                          )}
                          aria-expanded={isExpanded}
                          aria-controls={sectionId}
                          onClick={() => setExpandedMobileRootSlug((current) => (current === item.slug ? null : item.slug))}
                        >
                          <span>{item.name}</span>
                          <ChevronRight size={16} className="editorial-mobile-panel__section-icon" />
                        </button>

                        {isExpanded ? (
                          <div id={sectionId} className="editorial-mobile-panel__section-items">
                            {children.map((child) => (
                              <Link
                                key={child.id}
                                to={withKoPath(`/category/${child.slug}`)}
                                className={cn(
                                  "editorial-mobile-panel__sublink",
                                  currentCategory?.id === child.id && "editorial-mobile-panel__sublink--active",
                                )}
                                onClick={() => setMobileMenuOpen(false)}
                              >
                                <span>{child.name}</span>
                                <ChevronRight size={15} />
                              </Link>
                            ))}
                            <Link
                              to={withKoPath(`/category/${item.slug}`)}
                              className={cn(
                                "editorial-mobile-panel__sublink",
                                "editorial-mobile-panel__sublink--all",
                                isRootPage && "editorial-mobile-panel__sublink--active",
                              )}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              <span>전체 보기</span>
                              <ChevronRight size={15} />
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  <Link to={withKoPath("/about")} className="editorial-mobile-panel__link">
                    <span>소개</span>
                    <ChevronRight size={16} />
                  </Link>
                  <Link to={withKoPath("/search")} className="editorial-mobile-panel__link">
                    <span>검색</span>
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          <main className="editorial-main">
            <Outlet />
          </main>

          <EditorialFooter categories={categories} siteSettings={siteSettings} />
        </div>
      </CategoriesContext.Provider>
    </SiteSettingsContext.Provider>
  );
}

export function HomePage() {
  const siteSettings = useSiteSettings();
  const categories = useCategories();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [topPosts, setTopPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageMetadata({
    title: siteSettings.branding.siteTitle,
    description: siteSettings.branding.siteDescription,
    path: withKoPath("/"),
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createWebSiteStructuredData({
      name: siteSettings.branding.siteTitle,
      alternateName: siteSettings.branding.siteAltName,
      description: siteSettings.branding.siteDescription,
      path: withKoPath("/"),
    }),
  });

  useEffect(() => {
    setLoading(true);
    void Promise.all([listPosts(), listTopPosts(3)])
      .then(([publishedPosts, featuredPosts]) => {
        setPosts(publishedPosts);
        setTopPosts(featuredPosts);
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const spotlight = topPosts[0] ?? posts[0] ?? null;
  const supporting = Array.from(
    new Map(
      [...topPosts.slice(1), ...posts]
        .filter((post) => post.id !== spotlight?.id)
        .map((post) => [post.id, post] as const),
    ).values(),
  ).slice(0, 4);
  const excludedIds = new Set<string>(
    [spotlight?.id, ...supporting.map((post) => post.id)].filter((value): value is string => Boolean(value)),
  );
  const rootSections = useMemo(() => {
    return getRootNavigationItems(categories)
      .map((root) => ({
        root,
        posts: posts.filter((post) => !excludedIds.has(post.id) && postBelongsToRoot(post, root, categories)).slice(0, 4),
      }))
      .filter((section) => section.posts.length > 0);
  }, [categories, posts, excludedIds]);
  const latestArchive = useMemo(() => posts.filter((post) => !excludedIds.has(post.id)).slice(0, 8), [posts, excludedIds]);

  if (loading) {
    return <HomePageLoadingState siteTitle={siteSettings.branding.siteTitle} eyebrow={siteSettings.home.eyebrow} />;
  }

  return (
    <div className="editorial-page">
      <ErrorMessage message={error} />

      <section className="home-hero home-hero--stitch">
        {spotlight ? (
          <>
            <div className="home-hero-split">
              <Link to={withKoPath(`/post/${spotlight.slug}`)} className="home-hero-split__media">
                <CoverImage post={spotlight} priority="high" />
                <span className="home-hero-split__badge">대표 글</span>
              </Link>
              <div className="home-hero-split__copy">
                <div className="home-hero-split__meta">
                  <CategoryPill category={spotlight.category} />
                  <span>{getPostDateLabel(spotlight)}</span>
                </div>
                <p className="section-header__eyebrow">{siteSettings.home.eyebrow}</p>
                <h1 className="home-hero__title">{spotlight.title}</h1>
                <p className="home-hero__description">{getPostSummary(spotlight)}</p>
                <Link to={withKoPath(`/post/${spotlight.slug}`)} className="story-feature-card__link">
                  <span>전체 글 읽기</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="home-curated">
              <SectionHeader eyebrow="추천 글" title="지금 읽기 좋은 글" />
              <div className="home-curated__grid">
                {supporting.slice(0, 3).map((post) => (
                  <StoryGridCard key={post.id} post={post} className="home-curated__card" />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">아직 공개 글이 없습니다. 발행된 글이 생기면 메인 카드와 루트 섹션이 자동으로 채워집니다.</div>
        )}
      </section>

      {rootSections.length ? (
        <section className="home-root-grid">
          {rootSections.map((section) => (
            <RootSection key={section.root.id} root={section.root} posts={section.posts} />
          ))}
        </section>
      ) : null}

      <section className="home-newsletter">
        <div className="home-newsletter__copy">
          <p className="section-header__eyebrow">아카이브 구독</p>
          <h2 className="home-newsletter__title">새 글을 메일함에 받아보기</h2>
          <p className="home-newsletter__description">
            새 글 알림은 준비 중입니다. 지금은 RSS, 피드, 사이트맵으로 전체 아카이브를 바로 구독할 수 있습니다.
          </p>
        </div>
        <div className="home-newsletter__actions">
          <a href={RSS_FEED_URL} className="feed-callout__link">
            <Rss size={16} />
            <span>RSS</span>
          </a>
          <a href={FEED_XML_URL} className="feed-callout__link">
            <ArrowUpRight size={16} />
            <span>피드 XML</span>
          </a>
          <a href={SITEMAP_URL} className="feed-callout__link">
            <ArrowUpRight size={16} />
            <span>사이트맵</span>
          </a>
          <Link to={withKoPath("/search")} className="feed-callout__link">
            <Search size={16} />
              <span>검색으로 이동</span>
          </Link>
        </div>
      </section>

      {latestArchive.length ? (
        <section className="editorial-section">
          <SectionHeader
            eyebrow="최신 기록"
            title={siteSettings.home.latestTitle}
            description={siteSettings.home.latestDescription}
          />
          <div className="home-latest-grid">
            {latestArchive.slice(0, 8).map((post) => (
              <StoryGridCard key={post.id} post={post} className="home-latest-grid__card" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function PostPage() {
  const siteSettings = useSiteSettings();
  const categories = useCategories();
  const { slug = "" } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<PostSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const postPath = withKoPath(`/post/${slug}`);
  const readingMinutes = useMemo(() => (post ? estimateReadMinutes(post.content) : null), [post]);
  const postMetaTitle = post?.seoTitle?.trim() || post?.title || "";
  const postDescription =
    post?.seoDescription?.trim() ||
    post?.excerpt ||
    post?.subtitle ||
    (post ? buildExcerpt(post.content, 180) : siteSettings.branding.siteDescription);
  const rootCategory = useMemo(() => resolveRootCategory(post?.category ?? null, categories), [post?.category, categories]);
  const breadcrumbs = [
    { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
    ...(rootCategory && rootCategory.slug !== post?.category?.slug
      ? [{ name: rootCategory.name, path: withKoPath(`/category/${rootCategory.slug}`) }]
      : []),
    ...(post?.category?.slug
      ? [{ name: post.category.name, path: withKoPath(`/category/${post.category.slug}`) }]
      : []),
    { name: post?.title ?? "글", path: postPath },
  ];

  usePageMetadata({
    title: post ? `${postMetaTitle} | ${siteSettings.branding.siteTitle}` : `글을 불러오는 중 | ${siteSettings.branding.siteTitle}`,
    description: postDescription,
    path: postPath,
    robots: error ? "noindex,follow" : "index,follow",
    ogType: post ? "article" : "website",
    image: post?.coverImage ?? DEFAULT_OG_IMAGE_PATH,
    structuredData: post
      ? createBlogPostingStructuredData({
          title: postMetaTitle,
          description: postDescription,
          path: postPath,
          image: post.coverImage ?? DEFAULT_OG_IMAGE_PATH,
          publishedAt: post.publishedAt ?? post.createdAt,
          updatedAt: post.updatedAt,
          categoryName: post.category?.name,
          tags: post.tags.map((tag) => tag.name),
          authorName: "동그리",
          publisherName: "동그리의 기록소",
          publisherLogo: DEFAULT_OG_IMAGE_PATH,
          breadcrumbs,
        })
      : createWebPageStructuredData({
          name: `글을 찾는 중 | ${siteSettings.branding.siteTitle}`,
          description: siteSettings.branding.siteDescription,
          path: postPath,
          breadcrumbs,
        }),
  });

  useEffect(() => {
    setPost(null);
    setRelatedPosts([]);
    setError(null);
    setProgress(0);

    void getPost(slug)
      .then((item) => {
        setPost(item);
        setError(null);
      })
      .catch((reason: Error) => {
        setPost(null);
        setError(reason.message);
      });
  }, [slug]);

  useEffect(() => {
    if (!post?.slug || typeof window === "undefined") {
      return;
    }

    const key = `donggeuri:view:${post.slug}`;
    const today = new Date().toISOString().slice(0, 10);

    if (window.localStorage.getItem(key) === today) {
      return;
    }

    void recordPostView(post.slug)
      .then((result) => {
        setPost((current) => (current ? { ...current, viewCount: result.viewCount } : current));
        window.localStorage.setItem(key, today);
      })
      .catch(() => undefined);
  }, [post?.slug]);

  useEffect(() => {
    if (!post?.category?.slug) {
      setRelatedPosts([]);
      return;
    }

    void getCategoryFeed(post.category.slug)
      .then((value) => {
        setRelatedPosts(value.posts.filter((item) => item.slug !== post.slug).slice(0, 3));
      })
      .catch(() => setRelatedPosts([]));
  }, [post?.category?.slug, post?.slug]);

  useEffect(() => {
    if (!post) {
      return;
    }

    const updateProgress = () => {
      const element = document.documentElement;
      const maxScroll = element.scrollHeight - element.clientHeight;
      const nextProgress = maxScroll > 0 ? Math.min(100, (window.scrollY / maxScroll) * 100) : 0;
      setProgress(nextProgress);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [post]);

  if (!post && !error) {
    return <PostPageLoadingState siteTitle={siteSettings.branding.siteTitle} />;
  }

  return (
    <div className="editorial-page">
      <div className="post-progress">
        <div className="post-progress__bar" style={{ width: `${progress}%` }} />
      </div>

      <ErrorMessage message={error} />

      {post ? (
        <>
          <BreadcrumbTrail
            items={[
              { label: siteSettings.branding.siteTitle, href: withKoPath("/") },
              ...(rootCategory && rootCategory.slug !== post.category?.slug
                ? [{ label: rootCategory.name, href: withKoPath(`/category/${rootCategory.slug}`) }]
                : []),
              ...(post.category?.slug ? [{ label: post.category.name, href: withKoPath(`/category/${post.category.slug}`) }] : []),
              { label: post.title },
            ]}
          />

          <section className="detail-hero">
            <div className="detail-hero__copy">
              <p className="section-header__eyebrow">
                {getRootDescriptor(rootCategory?.slug)?.eyebrow ?? "기록 아카이브"}
              </p>
              <div className="detail-hero__meta">
                <CategoryPill category={post.category} />
                {post.tags.slice(0, 3).map((tag) => (
                  <Link key={tag.id} to={withKoPath(`/tag/${tag.slug}`)} className="category-pill category-pill--ghost">
                    #{tag.name}
                  </Link>
                ))}
              </div>
              <h1 className="detail-hero__title">{post.title}</h1>
              <p className="detail-hero__summary">
                {post.excerpt ?? post.subtitle ?? buildExcerpt(post.content, 220)}
              </p>
              <div className="detail-meta-grid">
                <div className="detail-meta-grid__item">
                  <span>발행</span>
                  <strong>{formatDate(post.publishedAt ?? post.createdAt)}</strong>
                </div>
                <div className="detail-meta-grid__item">
                  <span>수정</span>
                  <strong>{formatDate(post.updatedAt)}</strong>
                </div>
                <div className="detail-meta-grid__item">
                  <span>조회</span>
                  <strong>{post.viewCount ?? 0}</strong>
                </div>
                <div className="detail-meta-grid__item">
                  <span>읽기</span>
                  <strong>{readingMinutes ?? 1}분</strong>
                </div>
              </div>
            </div>

            <aside className="detail-hero__rail">
              <div className="detail-panel">
                <p className="section-header__eyebrow">기록 경로</p>
                <div className="detail-panel__links">
                  {post.category?.slug ? (
                    <Link to={withKoPath(`/category/${post.category.slug}`)} className="detail-panel__link">
                      {post.category.name}
                      <ArrowUpRight size={16} />
                    </Link>
                  ) : null}
                  {rootCategory?.slug && rootCategory.slug !== post.category?.slug ? (
                    <Link to={withKoPath(`/category/${rootCategory.slug}`)} className="detail-panel__link">
                      {rootCategory.name}
                      <ArrowUpRight size={16} />
                    </Link>
                  ) : null}
                </div>
              </div>
            </aside>
          </section>

          <div className="detail-layout">
            <article className="detail-article">
              <div className="detail-media detail-media--lead">
                <CoverImage post={post} priority="high" />
              </div>
              <MarkdownContent content={post.content} />
            </article>

            <aside className="detail-sidebar">
              {post.youtubeUrl ? <VideoEmbed title={post.title} youtubeUrl={post.youtubeUrl} /> : null}

              {relatedPosts.length ? (
                <section className="detail-panel">
                  <SectionHeader
                    eyebrow="함께 읽을 글"
                    title="함께 읽을 기록"
                    description="같은 카테고리에서 이어 읽기 좋은 글입니다."
                  />
                  <div className="detail-sidebar__stack">
                    {relatedPosts.map((relatedPost) => (
                      <StoryStackCard key={relatedPost.id} post={relatedPost} compact />
                    ))}
                  </div>
                </section>
              ) : null}

              <FeedCallout />
            </aside>
          </div>

          <PostComments slug={post.slug} />
        </>
      ) : (
        <div className="empty-state">요청한 글을 찾지 못했습니다.</div>
      )}
    </div>
  );
}


type CategoryPreviewSection = {
  category: Category;
  leadPost: PostSummary | null;
  archivePosts: PostSummary[];
};

function buildCategoryPreviewSections(
  currentCategory: Category | null,
  rootCategory: Category | null,
  rootChildren: Category[],
  posts: PostSummary[],
  categories: Category[],
) {
  if (!currentCategory) {
    return [];
  }

  if (rootCategory && currentCategory.id === rootCategory.id && rootChildren.length) {
    return rootChildren.map((child) => {
      const childPosts = posts.filter(
        (post) => resolveRootChildCategory(post.category ?? null, rootCategory, categories)?.id === child.id,
      );

      return {
        category: child,
        leadPost: childPosts[0] ?? null,
        archivePosts: childPosts.slice(1),
      } satisfies CategoryPreviewSection;
    });
  }

  return [
    {
      category: currentCategory,
      leadPost: posts[0] ?? null,
      archivePosts: posts.slice(1),
    } satisfies CategoryPreviewSection,
  ];
}

function CategoryPreviewSectionBlock(props: {
  section: CategoryPreviewSection;
  rootCategory: Category | null;
  siblingCategories: Category[];
  tone?: RootDescriptor["tone"];
  showAllPosts?: boolean;
}) {
  const note =
    props.section.category.description ??
    `${props.section.category.name}에 속한 글을 메인 글, NOTE, 아카이브 단위로 확인하는 실험 섹션입니다.`;
  const previewPath = withKoPath(`/category-preview/${props.section.category.slug}`);
  const actualPath = withKoPath(`/category/${props.section.category.slug}`);
  const archivePosts = props.showAllPosts ? props.section.archivePosts : props.section.archivePosts.slice(0, 4);
  const siblingCategories = props.siblingCategories.length ? props.siblingCategories : [props.section.category];
  const totalCount = (props.section.leadPost ? 1 : 0) + props.section.archivePosts.length;
  const primaryActionHref = props.showAllPosts ? actualPath : previewPath;
  const primaryActionLabel = props.showAllPosts ? "현재 페이지 비교" : "하위 프리뷰";

  return (
    <section className="category-preview-section">
      <SectionHeader
        eyebrow={props.rootCategory && props.rootCategory.id !== props.section.category.id ? "Subcategory Focus" : "Category Focus"}
        title={props.section.category.name}
        description={note}
        actionHref={primaryActionHref}
        actionLabel={primaryActionLabel}
      />

      <div className="category-preview-section__lead">
        {props.section.leadPost ? (
          <StoryFeatureCard post={props.section.leadPost} tone={props.tone ?? "tech"} />
        ) : (
          <div className="empty-state category-preview-section__empty">
            아직 이 섹션에 공개 글이 없습니다. 구조와 정보 배치만 먼저 확인할 수 있도록 비워둔 상태입니다.
          </div>
        )}

        <aside className="category-preview-section__rail">
          <div className="detail-panel">
            <p className="section-header__eyebrow">NOTE</p>
            <p className="detail-panel__text">{note}</p>
            <div className="detail-meta-grid detail-meta-grid--compact">
              <div className="detail-meta-grid__item">
                <span>글 수</span>
                <strong>{totalCount}</strong>
              </div>
              <div className="detail-meta-grid__item">
                <span>구성</span>
                <strong>{props.showAllPosts ? "전체" : "섹션"}</strong>
              </div>
            </div>
            <div className="category-preview-section__actions">
              <Link to={previewPath} className="feed-callout__link">
                프리뷰
              </Link>
              <Link to={actualPath} className="feed-callout__link">
                현재 페이지
              </Link>
            </div>
          </div>

          <div className="detail-panel">
            <p className="section-header__eyebrow">주요 카테고리</p>
            <h3 className="category-preview-section__panel-title">주요 카테고리</h3>
            <p className="detail-panel__text">칩을 필터처럼 두지 않고, 어떤 섹션을 보여줄지 분명하게 연결합니다.</p>
            <div className="chip-row">
              {siblingCategories.map((category) => (
                <Link
                  key={category.id}
                  to={withKoPath(`/category-preview/${category.slug}`)}
                  className={cn(
                    "category-pill",
                    category.id === props.section.category.id ? "category-pill--active" : "category-pill--ghost",
                  )}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {archivePosts.length ? (
        <div className="category-preview-section__archive">
          <SectionHeader
            eyebrow={props.showAllPosts ? "전체 글" : "글 미리보기"}
            title={props.showAllPosts ? `${props.section.category.name} 전체 글` : `${props.section.category.name} 미리보기 글`}
            description={
              props.showAllPosts
                ? "해당 하위 카테고리에 작성된 글을 모두 이어서 보여줍니다."
                : "루트 카테고리 안에서 먼저 훑어볼 수 있도록 일부 글만 노출합니다."
            }
          />
          <div className="story-list">
            {archivePosts.map((post) => (
              <StoryListItem key={post.id} post={post} />
            ))}
          </div>
        </div>
      ) : null}

      {!props.showAllPosts && props.section.archivePosts.length > archivePosts.length ? (
        <div className="category-preview-section__footer">
          <Link to={previewPath} className="section-header__action">
            <span>전체 글 {totalCount}개 보기</span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
export function CategoryArchivePage() {
  const siteSettings = useSiteSettings();
  const categories = useCategories();
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const decodedSlug = decodeSlugParam(slug);
  const effectiveSlug = LEGACY_CATEGORY_SLUG_MAP[decodedSlug] ?? decodedSlug;
  const [feed, setFeed] = useState<CategoryFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const categoryPath = withKoPath(`/category/${effectiveSlug}`);
  const currentCategory = useMemo(
    () => getCanonicalCategory(feed?.category ?? findCategoryBySlug(categories, effectiveSlug), categories),
    [feed?.category, categories, effectiveSlug],
  );
  const rootCategory = useMemo(() => resolveRootCategory(currentCategory, categories), [currentCategory, categories]);
  const rootChildren = useMemo(
    () => (rootCategory ? getChildCategories(rootCategory.id, categories) : []),
    [rootCategory, categories],
  );
  const leadPost = feed?.posts[0] ?? null;
  const supportingPosts = feed?.posts.slice(1, 5) ?? [];
  const archiveGridPosts = useMemo(() => {
    if (!feed) {
      return [];
    }

    return feed.posts.filter((post) => post.id !== leadPost?.id).slice(0, 12);
  }, [feed, leadPost?.id]);
  const categoryDescription =
    currentCategory?.description ?? rootCategory?.description ?? "선택한 카테고리에 속한 공개 글을 흐름별로 정리한 페이지입니다.";
  const categoryTitle = currentCategory?.name ?? "카테고리";
  const descriptor = getRootDescriptor(rootCategory?.slug ?? currentCategory?.slug ?? null);
  const breadcrumbs = [
    { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
    ...(rootCategory?.slug ? [{ name: rootCategory.name, path: withKoPath(`/category/${rootCategory.slug}`) }] : []),
    ...(currentCategory?.slug && currentCategory.slug !== rootCategory?.slug
      ? [{ name: currentCategory.name, path: categoryPath }]
      : rootCategory?.slug
        ? []
        : [{ name: categoryTitle, path: categoryPath }]),
  ];

  usePageMetadata({
    title: `${categoryTitle} | ${siteSettings.branding.siteTitle}`,
    description: categoryDescription,
    path: categoryPath,
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createCollectionPageStructuredData({
      name: `${categoryTitle} | ${siteSettings.branding.siteTitle}`,
      description: categoryDescription,
      path: categoryPath,
      breadcrumbs,
    }),
  });

  useEffect(() => {
    if (decodedSlug !== effectiveSlug) {
      navigate(withKoPath(`/category/${effectiveSlug}`), { replace: true });
      return;
    }

    setFeed(null);
    setError(null);
    void getCategoryFeed(effectiveSlug)
      .then((value) => {
        setFeed(value);
        setError(null);
      })
      .catch((reason: Error) => {
        setFeed(null);
        setError(reason.message);
      });
  }, [decodedSlug, effectiveSlug, navigate]);

  if (!feed && !error) {
    return (
      <ArchivePageLoadingState
        siteTitle={siteSettings.branding.siteTitle}
        eyebrow={descriptor?.eyebrow ?? "카테고리 아카이브"}
        title={categoryTitle}
        description={categoryDescription}
        chipLabels={rootChildren.map((child) => child.name)}
      />
    );
  }

  return (
    <div className="editorial-page">
      <ErrorMessage message={error} />

      <BreadcrumbTrail
        items={[
          { label: siteSettings.branding.siteTitle, href: withKoPath("/") },
          ...(rootCategory?.slug ? [{ label: rootCategory.name, href: withKoPath(`/category/${rootCategory.slug}`) }] : []),
          ...(currentCategory?.slug && currentCategory.slug !== rootCategory?.slug
            ? [{ label: currentCategory.name }]
            : rootCategory?.slug
              ? []
              : [{ label: categoryTitle }]),
        ]}
      />

      <section className="page-hero page-hero--archive">
        <div className="page-hero__copy">
          <p className="section-header__eyebrow">{descriptor?.eyebrow ?? "카테고리 아카이브"}</p>
          <h1 className="page-hero__title">{categoryTitle}</h1>
          <p className="page-hero__description">{categoryDescription}</p>
          {rootChildren.length ? (
            <div className="chip-row">
              {rootChildren.map((child) => (
                <Link
                  key={child.id}
                  to={withKoPath(`/category/${child.slug}`)}
                  className={cn(
                    "category-pill",
                    currentCategory?.id === child.id ? "category-pill--active" : "category-pill--ghost",
                  )}
                >
                  {child.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

      </section>

      {leadPost ? (
        <section className="archive-lead archive-lead--category">
          <div className={cn("archive-lead__grid", supportingPosts.length === 0 && "archive-lead__grid--single")}>
            <StoryFeatureCard
              post={leadPost}
              tone={descriptor?.tone ?? getRootDescriptor(resolveRootCategory(leadPost.category ?? null, categories)?.slug)?.tone}
            />
            <aside className="archive-lead__rail">
              <div className="detail-panel">
                <p className="section-header__eyebrow">큐레이터 노트</p>
                <p className="detail-panel__text">{categoryDescription}</p>
              </div>
              {supportingPosts.length ? (
                <div className="detail-panel">
                  <SectionHeader
                    eyebrow="Top Chronicles"
                    title="카테고리 주요 글"
                    description="현재 카테고리에서 먼저 읽기 좋은 글을 모았습니다."
                  />
                  <div className="top-chronicle-list">
                    {supportingPosts.slice(0, 4).map((post) => (
                      <TopChronicleLink key={post.id} post={post} />
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </section>
      ) : (
        <div className="empty-state">이 카테고리에는 아직 공개된 글이 없습니다.</div>
      )}

      <section className="category-search-strip">
        <div className="category-search-strip__copy">
          <p className="section-header__eyebrow">기록 검색</p>
          <h2 className="section-header__title">카테고리 기록 검색</h2>
        </div>
        <SearchForm placeholder={`${categoryTitle} 키워드를 검색해보세요`} />
      </section>

      {archiveGridPosts.length ? (
        <section className="editorial-section">
          <div className="category-grid">
            {archiveGridPosts.map((post) => (
              <StoryGridCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      ) : null}

      {archiveGridPosts.length > 6 ? (
        <nav className="category-pagination" aria-label="pagination">
          <button type="button" className="category-pagination__button category-pagination__button--active">
            1
          </button>
          <button type="button" className="category-pagination__button">
            2
          </button>
          <button type="button" className="category-pagination__button">
            3
          </button>
        </nav>
      ) : null}

    </div>
  );
}


export function CategoryArchivePreviewPage() {
  const siteSettings = useSiteSettings();
  const categories = useCategories();
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const decodedSlug = decodeSlugParam(slug);
  const effectiveSlug = LEGACY_CATEGORY_SLUG_MAP[decodedSlug] ?? decodedSlug;
  const [feed, setFeed] = useState<CategoryFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewPath = withKoPath(`/category-preview/${effectiveSlug}`);
  const actualPath = withKoPath(`/category/${effectiveSlug}`);
  const currentCategory = useMemo(
    () => getCanonicalCategory(feed?.category ?? findCategoryBySlug(categories, effectiveSlug), categories),
    [feed?.category, categories, effectiveSlug],
  );
  const rootCategory = useMemo(() => resolveRootCategory(currentCategory, categories), [currentCategory, categories]);
  const rootChildren = useMemo(
    () => (rootCategory ? getChildCategories(rootCategory.id, categories) : []),
    [rootCategory, categories],
  );
  const isRootCategory = Boolean(rootCategory && currentCategory && rootCategory.id === currentCategory.id);
  const categoryTitle = currentCategory?.name ?? "카테고리";
  const descriptor = getRootDescriptor(rootCategory?.slug ?? currentCategory?.slug ?? null);
  const heroCategories = rootChildren.length ? rootChildren : currentCategory ? [currentCategory] : [];
  const previewSections = useMemo(
    () => buildCategoryPreviewSections(currentCategory, rootCategory, rootChildren, feed?.posts ?? [], categories),
    [currentCategory, rootCategory, rootChildren, feed?.posts, categories],
  );
  const directRootPostCount = useMemo(() => {
    if (!feed || !rootCategory || !isRootCategory) {
      return 0;
    }

    return feed.posts.filter((post) => post.category?.id === rootCategory.id).length;
  }, [feed, rootCategory, isRootCategory]);
  const layoutTitle = isRootCategory ? `${categoryTitle} 섹션형 프리뷰` : `${categoryTitle} 전체 아카이브 프리뷰`;
  const layoutDescription = isRootCategory
    ? "하위 카테고리를 상단 칩이 아니라 독립 섹션으로 보여주는 실험안입니다. 각 섹션은 메인 글, NOTE, 주요 카테고리, 글 미리보기로 구성합니다."
    : "하위 카테고리 페이지에서는 메인 글 뒤에 해당 카테고리에 작성된 글을 모두 이어서 보여주는 실험안입니다.";

  usePageMetadata({
    title: `${layoutTitle} | ${siteSettings.branding.siteTitle}`,
    description: layoutDescription,
    path: previewPath,
    robots: "noindex,nofollow",
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createWebPageStructuredData({
      name: `${layoutTitle} | ${siteSettings.branding.siteTitle}`,
      description: layoutDescription,
      path: previewPath,
      breadcrumbs: [
        { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
        ...(rootCategory?.slug ? [{ name: rootCategory.name, path: withKoPath(`/category-preview/${rootCategory.slug}`) }] : []),
        ...(currentCategory?.slug && currentCategory.slug !== rootCategory?.slug
          ? [{ name: currentCategory.name, path: previewPath }]
          : []),
        { name: "카테고리 프리뷰", path: previewPath },
      ],
    }),
  });

  useEffect(() => {
    if (decodedSlug !== effectiveSlug) {
      navigate(previewPath, { replace: true });
      return;
    }

    setFeed(null);
    setError(null);
    void getCategoryFeed(effectiveSlug)
      .then((value) => {
        setFeed(value);
        setError(null);
      })
      .catch((reason: Error) => {
        setFeed(null);
        setError(reason.message);
      });
  }, [decodedSlug, effectiveSlug, navigate, previewPath]);

  if (!feed && !error) {
    return (
      <ArchivePageLoadingState
        siteTitle={siteSettings.branding.siteTitle}
        eyebrow="카테고리 레이아웃 프리뷰"
        title={layoutTitle}
        description={layoutDescription}
        chipLabels={heroCategories.map((category) => category.name)}
      />
    );
  }

  return (
    <div className="editorial-page">
      <ErrorMessage message={error} />

      <BreadcrumbTrail
        items={[
          { label: siteSettings.branding.siteTitle, href: withKoPath("/") },
          ...(rootCategory?.slug ? [{ label: rootCategory.name, href: withKoPath(`/category-preview/${rootCategory.slug}`) }] : []),
          ...(currentCategory?.slug && currentCategory.slug !== rootCategory?.slug ? [{ label: currentCategory.name }] : []),
          { label: "레이아웃 프리뷰" },
        ]}
      />

      <section className="page-hero page-hero--archive">
        <div className="page-hero__copy">
          <p className="section-header__eyebrow">카테고리 레이아웃 프리뷰</p>
          <h1 className="page-hero__title">{layoutTitle}</h1>
          <p className="page-hero__description">{layoutDescription}</p>
          {heroCategories.length ? (
            <div className="chip-row">
              {heroCategories.map((category) => (
                <Link
                  key={category.id}
                  to={withKoPath(`/category-preview/${category.slug}`)}
                  className={cn(
                    "category-pill",
                    category.id === currentCategory?.id ? "category-pill--active" : "category-pill--ghost",
                  )}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <aside className="page-hero__rail">
          <div className="detail-panel category-preview-banner">
            <p className="section-header__eyebrow">프리뷰 방향</p>
            <p className="detail-panel__text">
              {isRootCategory
                ? "루트 카테고리에서는 하위 카테고리를 카드 섹션으로 펼치고, 각 섹션에서 바로 메인 글과 글 묶음을 보여줍니다."
                : "하위 카테고리에서는 메인 글 뒤에 전체 글 목록을 이어 붙여 탐색 흐름을 단순하게 만듭니다."}
            </p>
            {directRootPostCount ? (
              <p className="detail-panel__text">
                루트 카테고리에 직접 연결된 글 {directRootPostCount}개는 별도 처리 방식이 필요합니다.
              </p>
            ) : null}
            <div className="category-preview-section__actions">
              <Link to={actualPath} className="feed-callout__link">
                현재 페이지
              </Link>
              {rootCategory?.slug && currentCategory?.slug !== rootCategory.slug ? (
                <Link to={withKoPath(`/category-preview/${rootCategory.slug}`)} className="feed-callout__link">
                  루트 프리뷰
                </Link>
              ) : null}
            </div>
          </div>

          <div className="detail-panel">
            <p className="section-header__eyebrow">프리뷰 범위</p>
            <div className="detail-meta-grid detail-meta-grid--compact">
              <div className="detail-meta-grid__item">
                <span>루트</span>
                <strong>{rootCategory?.name ?? categoryTitle}</strong>
              </div>
              <div className="detail-meta-grid__item">
                <span>섹션</span>
                <strong>{previewSections.length}</strong>
              </div>
              <div className="detail-meta-grid__item">
                <span>글 수</span>
                <strong>{feed?.posts.length ?? 0}</strong>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {previewSections.length ? (
        <div className="category-preview-stack">
          {previewSections.map((section) => (
            <CategoryPreviewSectionBlock
              key={section.category.id}
              section={section}
              rootCategory={rootCategory}
              siblingCategories={heroCategories}
              tone={descriptor?.tone ?? "tech"}
              showAllPosts={!isRootCategory}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">이 카테고리에는 아직 공개 글이 없어 프리뷰에 표시할 섹션이 없습니다.</div>
      )}
    </div>
  );
}
export function TagArchivePage() {
  const siteSettings = useSiteSettings();
  const categories = useCategories();
  const { slug = "" } = useParams();
  const [feed, setFeed] = useState<TagFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tagPath = withKoPath(`/tag/${slug}`);
  const tagName = feed?.tag.name ?? "태그";
  const tagHeading = feed ? `#${feed.tag.name}` : "태그";
  const tagMetaTitle = feed
    ? getTagMetaTitle(feed.tag.name, siteSettings.branding.siteTitle, feed.tag.seoTitle)
    : `태그 글 모음 | ${siteSettings.branding.siteTitle}`;
  const tagMetaDescription = getTagMetaDescription(feed?.tag);
  const robots = feed ? (computeTagIndexCandidate(feed.tag) ? "index,follow" : "noindex,follow") : "noindex,follow";
  const featuredPost = feed?.featuredPost ?? feed?.posts[0] ?? null;
  const remainingPosts = useMemo(
    () => (feed?.posts ?? []).filter((post) => post.id !== featuredPost?.id),
    [feed?.posts, featuredPost?.id],
  );

  usePageMetadata({
    title: tagMetaTitle,
    description: tagMetaDescription,
    path: tagPath,
    robots,
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createCollectionPageStructuredData({
      name: tagMetaTitle,
      description: tagMetaDescription,
      path: tagPath,
      breadcrumbs: [
        { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
        { name: tagName, path: tagPath },
      ],
    }),
  });

  useEffect(() => {
    setFeed(null);
    setError(null);
    void getTagFeed(slug)
      .then((value) => {
        setFeed(value);
        setError(null);
      })
      .catch((reason: Error) => {
        setFeed(null);
        setError(reason.message);
      });
  }, [slug]);

  if (!feed && !error) {
    return (
      <ArchivePageLoadingState
        siteTitle={siteSettings.branding.siteTitle}
        eyebrow="태그 아카이브"
        title={tagHeading}
        description="태그별로 공개 글을 모아보는 페이지를 불러오는 중입니다."
      />
    );
  }

  return (
    <div className="editorial-page">
      <ErrorMessage message={error} />
      <BreadcrumbTrail
        items={[
          { label: siteSettings.branding.siteTitle, href: withKoPath("/") },
          { label: "태그" },
          { label: tagHeading },
        ]}
      />

      <section className="page-hero">
        <div className="page-hero__copy">
          <p className="section-header__eyebrow">태그 아카이브</p>
          <h1 className="page-hero__title">{tagHeading}</h1>
          <p className="page-hero__description">
            {feed?.tag.description?.trim() || (feed ? `${feed.tag.name}로 연결된 글을 한 번에 읽기 쉽게 정리했습니다.` : "태그로 연결된 글을 모아보는 페이지입니다.")}
          </p>
        </div>
        <aside className="page-hero__rail">
          <div className="detail-panel">
            <p className="section-header__eyebrow">태그 상태</p>
            <div className="detail-meta-grid detail-meta-grid--compact">
              <div className="detail-meta-grid__item">
                <span>태그</span>
                <strong>{tagHeading}</strong>
              </div>
              <div className="detail-meta-grid__item">
                <span>공개 글 수</span>
                <strong>{Number(feed?.tag.publishedCount ?? feed?.posts.length ?? 0)}</strong>
              </div>
              <div className="detail-meta-grid__item">
                <span>최근 발행일</span>
                <strong>{feed?.tag.latestPublishedAt ? formatDate(feed.tag.latestPublishedAt) : "발행 이력 없음"}</strong>
              </div>
              <div className="detail-meta-grid__item">
                <span>robots</span>
                <strong>{robots}</strong>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {featuredPost ? (
        <section className="archive-lead">
          <div className="archive-lead__grid archive-lead__grid--single">
            <StoryFeatureCard
              post={featuredPost}
              tone={getRootDescriptor(resolveRootCategory(featuredPost.category ?? null, categories)?.slug)?.tone}
            />
          </div>
        </section>
      ) : (
        <div className="empty-state">이 태그에는 아직 공개된 글이 없습니다.</div>
      )}

      {remainingPosts.length ? (
        <section className="editorial-section">
          <SectionHeader
            eyebrow="태그 연결 글"
            title="같이 묶인 글"
            description="같은 태그로 연결된 기록을 이어서 살펴볼 수 있습니다."
          />
          <div className="story-list">
            {remainingPosts.map((post) => (
              <StoryListItem key={post.id} post={post} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function SearchPage() {
  const siteSettings = useSiteSettings();
  const categories = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentQuery = searchParams.get("q")?.trim() ?? "";
  const [draft, setDraft] = useState(currentQuery);
  const [results, setResults] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const leadPost = results[0] ?? null;
  const remainingPosts = results.slice(1);

  const syncQuery = (query: string) => {
    if (!query) {
      setSearchParams({}, { replace: true });
      return;
    }

    setSearchParams({ q: query }, { replace: true });
  };

  usePageMetadata({
    title: currentQuery ? `"${currentQuery}" 검색 | ${siteSettings.branding.siteTitle}` : `검색 | ${siteSettings.branding.siteTitle}`,
    description: siteSettings.search.description,
    path: withKoPath("/search"),
    robots: "noindex,follow",
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createWebPageStructuredData({
      name: currentQuery ? `"${currentQuery}" 검색 | ${siteSettings.branding.siteTitle}` : `검색 | ${siteSettings.branding.siteTitle}`,
      description: siteSettings.search.description,
      path: withKoPath("/search"),
      breadcrumbs: [
        { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
        { name: "검색", path: withKoPath("/search") },
      ],
    }),
  });

  useEffect(() => {
    setDraft(currentQuery);

    if (!currentQuery) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    void searchPosts(currentQuery)
      .then((result) => {
        setResults(result.posts);
        setError(null);
      })
      .catch((reason: Error) => {
        setResults([]);
        setError(reason.message);
      })
      .finally(() => setLoading(false));
  }, [currentQuery]);

  useEffect(() => {
    const normalizedDraft = draft.trim();

    if (normalizedDraft === currentQuery) {
      return;
    }

    const timer = window.setTimeout(() => {
      syncQuery(normalizedDraft);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [draft, currentQuery, setSearchParams]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isEditable = Boolean(
        target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable),
      );

      if (isEditable) {
        return;
      }

      if (event.key === "/" || event.key.toLowerCase() === "s") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    syncQuery(draft.trim());
  };

  return (
    <div className="editorial-page">
      <ErrorMessage message={error} />
      <BreadcrumbTrail
        items={[
          { label: siteSettings.branding.siteTitle, href: withKoPath("/") },
          { label: "검색" },
        ]}
      />

      <section className="page-hero">
        <div className="page-hero__copy">
          <p className="section-header__eyebrow">{siteSettings.search.eyebrow}</p>
          <h1 className="page-hero__title">{siteSettings.search.title}</h1>
          <p className="page-hero__description">{siteSettings.search.description}</p>
        </div>
        <aside className="page-hero__rail">
          <div className="detail-panel">
            <p className="section-header__eyebrow">검색 현황</p>
            <div className="detail-meta-grid detail-meta-grid--compact">
              <div className="detail-meta-grid__item">
                <span>쿼리</span>
                <strong>{currentQuery || "없음"}</strong>
              </div>
              <div className="detail-meta-grid__item">
                <span>결과</span>
                <strong>{results.length}</strong>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <form className="search-panel" onSubmit={handleSubmit}>
        <Input
          ref={searchInputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={siteSettings.search.placeholder}
          aria-label="검색어"
          className="search-panel__input"
        />
        <Button type="submit" className="search-panel__button">
          검색
        </Button>
      </form>
      <p className="search-panel__hint">
        단축키 <code>/</code> 또는 <code>s</code> 로 언제든 검색창으로 바로 이동할 수 있습니다.
      </p>

      {currentQuery ? (
        <>
          {loading ? (
            <SearchResultsLoadingState query={currentQuery} />
          ) : leadPost ? (
            <section className="archive-lead">
              <div className="archive-lead__grid archive-lead__grid--single">
                <StoryFeatureCard
                  post={leadPost}
                  tone={getRootDescriptor(resolveRootCategory(leadPost.category ?? null, categories)?.slug)?.tone}
                />
              </div>
            </section>
          ) : null}

          {!loading && remainingPosts.length ? (
            <section className="editorial-section">
              <SectionHeader
                eyebrow={loading ? "검색 중" : "검색 결과"}
                title={loading ? "검색 결과를 모으는 중입니다." : `"${currentQuery}" 검색 결과`}
                description={loading ? "공개 글에서 관련 기록을 찾고 있습니다." : `${results.length}개의 글을 찾았습니다.`}
              />
              <div className="story-list">
                {remainingPosts.map((post) => (
                  <StoryListItem key={post.id} post={post} />
                ))}
              </div>
            </section>
          ) : !loading && currentQuery && !leadPost ? (
            <div className="empty-state">일치하는 공개 글이 없습니다. 다른 키워드로 다시 검색해보세요.</div>
          ) : null}
        </>
      ) : (
        <div className="empty-state">궁금한 주제 하나만 입력해도 관련 기록을 빠르게 다시 찾을 수 있습니다.</div>
      )}
    </div>
  );
}

export function AboutPage() {
  const siteSettings = useSiteSettings();
  const categories = useCategories();
  const operatorProfile = {
    role: "동그리 | 운영자 · 편집자",
    description:
      "동그리는 동그리아카이브를 운영하며 기술, 시장, 현장, 미스터리 기록을 구조화해 다시 찾기 쉬운 글로 정리합니다.",
    principle:
      "실명보다 필명과 편집 책임을 공개하고, 사실과 해석, 출처를 구분하는 방식을 운영 원칙으로 둡니다.",
    contact: `공식 문의와 정정, 삭제, 저작권 요청은 ${CONTACT_EMAIL}로 받습니다.`,
  };
  const rootItems = useMemo(() => getRootNavigationItems(categories), [categories]);
  const archiveGroups = useMemo(
    () =>
      rootItems.map((root) => ({
        root,
        children: categories.filter((category) => category.parentId === root.id).sort((left, right) => left.name.localeCompare(right.name, "ko")),
      })),
    [rootItems, categories],
  );
  const operationsCards = [
    {
      eyebrow: "운영 목적",
      title: "무엇을 남기고 왜 공개하는가",
      description:
        "동그리 아카이브는 개인적 관심사와 공공 정보 사이를 오가며, 다시 찾을 수 있는 기록 구조를 만드는 것을 목표로 합니다. 단발성 감상보다 맥락과 재탐색 가능성을 우선합니다.",
      href: withKoPath("/editorial-policy"),
      linkLabel: "편집 정책",
      chips: ["카테고리 중심", "재탐색 가능한 구조", "공개 아카이브"],
    },
    {
      eyebrow: "연락과 정정",
      title: "문의, 정정, 삭제 요청 경로",
      description: `운영 관련 문의와 정정 요청, 저작권 또는 삭제 요청은 ${CONTACT_EMAIL}로 받습니다. 확인 가능한 근거와 대상 URL을 함께 보내면 더 빠르게 검토합니다.`,
      href: withKoPath("/contact"),
      linkLabel: "문의 페이지",
      chips: ["정정 요청", "저작권 문의", "삭제 요청"],
    },
    {
      eyebrow: "기록 기준",
      title: "사실, 해석, 외부 자료를 구분한다",
      description:
        "사실로 단정할 수 있는 내용과 해석이 필요한 내용을 분리하고, 외부 자료는 출처 확인이 가능한 범위에서만 정리합니다. 광고나 협찬보다 독자가 다시 읽을 때의 신뢰도를 먼저 봅니다.",
      href: withKoPath("/disclaimer"),
      linkLabel: "면책 및 출처 기준",
      chips: ["사실과 해석 분리", "출처 기준", "과장 최소화"],
    },
    {
      eyebrow: "탐색 경로",
      title: "검색과 피드, 사이트맵으로 다시 찾는다",
      description:
        "메인, 카테고리, 상세 글뿐 아니라 검색, RSS, 사이트맵까지 하나의 탐색 흐름으로 연결합니다. Search Console과 색인 관리도 이 구조를 기준으로 운영합니다.",
      href: withKoPath("/privacy"),
      linkLabel: "정책 페이지",
      chips: ["검색", "RSS", "사이트맵"],
    },
  ];

  usePageMetadata({
    title: `소개 | ${siteSettings.branding.siteTitle}`,
    description: siteSettings.about.description,
    path: withKoPath("/about"),
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createWebPageStructuredData({
      type: "AboutPage",
      name: `소개 | ${siteSettings.branding.siteTitle}`,
      description: siteSettings.about.description,
      path: withKoPath("/about"),
      breadcrumbs: [
        { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
        { name: "소개", path: withKoPath("/about") },
      ],
    }),
  });

  return (
    <div className="editorial-page">
      <BreadcrumbTrail
        items={[
          { label: siteSettings.branding.siteTitle, href: withKoPath("/") },
          { label: "소개" },
        ]}
      />

      <section className="page-hero">
        <div className="page-hero__copy">
          <p className="section-header__eyebrow">{siteSettings.about.eyebrow}</p>
          <h1 className="page-hero__title">{siteSettings.about.title}</h1>
          <p className="page-hero__description">{siteSettings.about.description}</p>
        </div>
        <aside className="page-hero__rail">
          <div className="detail-panel">
            <p className="section-header__eyebrow">운영자</p>
            <p className="detail-panel__text"><strong>{operatorProfile.role}</strong></p>
            <p className="detail-panel__text">{operatorProfile.description}</p>
            <p className="detail-panel__text">{operatorProfile.contact}</p>
          </div>
          <div className="detail-panel">
            <p className="section-header__eyebrow">운영 기준</p>
            <p className="detail-panel__text">{siteSettings.branding.siteDescription}</p>
            <p className="detail-panel__text">{operatorProfile.principle}</p>
            <div className="feed-callout__actions">
              <Link to={withKoPath("/contact")} className="feed-callout__link">
                <span>문의하기</span>
              </Link>
              <Link to={withKoPath("/editorial-policy")} className="feed-callout__link">
                <span>편집 정책</span>
              </Link>
            </div>
          </div>
        </aside>
      </section>

      <section className="manifesto-card">
        <div className="manifesto-card__copy">
          <p className="section-header__eyebrow">아카이브 선언</p>
          <h2 className="manifesto-card__title">{siteSettings.about.featureTitle}</h2>
          <p className="manifesto-card__description">{siteSettings.about.featureDescription}</p>
        </div>
        <aside className="manifesto-card__aside">
          <ul className="manifesto-card__list">
            <li>루트 카테고리 중심으로 글의 흐름과 맥락을 정리합니다.</li>
            <li>하위 카테고리로 주제를 세분화해 읽기 동선을 분명하게 구성합니다.</li>
            <li>검색, RSS, 사이트맵으로 공개 기록을 더 쉽게 다시 찾을 수 있게 합니다.</li>
          </ul>
          <div className="feed-callout__actions">
            <a href={RSS_FEED_URL} className="feed-callout__link">
              <Rss size={16} />
              <span>RSS</span>
            </a>
            <Link to={withKoPath("/search")} className="feed-callout__link">
              <Search size={16} />
              <span>검색</span>
            </Link>
          </div>
        </aside>
      </section>

      <section className="editorial-section">
        <SectionHeader
          eyebrow="카테고리 지도"
          title={siteSettings.about.categoriesTitle}
          description={siteSettings.about.categoriesDescription}
        />
        <div className="about-grid">
          {archiveGroups.map((group) => (
            <article key={group.root.slug} className="about-card">
              <div className="about-card__head">
                <div>
                  <p className="section-header__eyebrow">{getRootDescriptor(group.root.slug)?.eyebrow ?? "기록"}</p>
                  <h3 className="about-card__title">{group.root.name}</h3>
                </div>
                <Link to={withKoPath(`/category/${group.root.slug}`)} className="section-header__action">
                  <span>보기</span>
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              <p className="about-card__description">{group.root.description ?? getRootDescriptor(group.root.slug)?.description}</p>
              {group.children.length ? (
                <div className="chip-row">
                  {group.children.map((child) => (
                    <Link key={child.id} to={withKoPath(`/category/${child.slug}`)} className="category-pill category-pill--ghost">
                      {child.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="editorial-section">
        <SectionHeader
          eyebrow="운영 정보"
          title="공개 운영 기준과 연락 경로"
          description="Search Console, 정책 페이지, 정정 요청, 출처 기준처럼 운영 신뢰도와 직접 연결되는 항목을 한 곳에서 공개합니다."
        />
        <div className="about-grid">
          {operationsCards.map((card) => (
            <article key={card.title} className="about-card">
              <div className="about-card__head">
                <div>
                  <p className="section-header__eyebrow">{card.eyebrow}</p>
                  <h3 className="about-card__title">{card.title}</h3>
                </div>
                <Link to={card.href} className="section-header__action">
                  <span>{card.linkLabel}</span>
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              <p className="about-card__description">{card.description}</p>
              <div className="chip-row">
                {card.chips.map((chip) => (
                  <span key={chip} className="category-pill category-pill--ghost">
                    {chip}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function PostPageLoadingState(props: { siteTitle: string }) {
  return (
    <div className="editorial-page" aria-busy="true" aria-live="polite">
      <div className="post-progress">
        <div className="post-progress__bar" style={{ width: "0%" }} />
      </div>

      <BreadcrumbTrail
        items={[
          { label: props.siteTitle, href: withKoPath("/") },
          { label: "글을 불러오는 중" },
        ]}
      />

      <section className="detail-hero detail-loading-shell">
        <div className="detail-hero__copy">
          <span className="detail-loading-block detail-loading-block--eyebrow" />

          <div className="detail-hero__meta">
            <span className="detail-loading-block detail-loading-block--chip" />
            <span className="detail-loading-block detail-loading-block--chip detail-loading-block--chip-wide" />
            <span className="detail-loading-block detail-loading-block--chip" />
          </div>

          <div className="detail-loading-stack">
            <span className="detail-loading-block detail-loading-block--title-lg" />
            <span className="detail-loading-block detail-loading-block--title-md" />
          </div>

          <div className="detail-loading-stack">
            <span className="detail-loading-block detail-loading-block--summary-lg" />
            <span className="detail-loading-block detail-loading-block--summary-lg" />
            <span className="detail-loading-block detail-loading-block--summary-sm" />
          </div>

          <div className="detail-meta-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="detail-meta-grid__item detail-loading-metric">
                <span className="detail-loading-block detail-loading-block--meta-label" />
                <span className="detail-loading-block detail-loading-block--meta-value" />
              </div>
            ))}
          </div>
        </div>

        <aside className="detail-hero__rail">
          <div className="detail-panel detail-loading-panel">
            <span className="detail-loading-block detail-loading-block--eyebrow" />
            <span className="detail-loading-block detail-loading-block--summary-md" />
            <span className="detail-loading-block detail-loading-block--summary-sm" />
          </div>
        </aside>
      </section>

      <div className="detail-layout">
        <article className="detail-article detail-article--loading">
          <div className="detail-media detail-media--lead">
            <div className="detail-loading-block detail-loading-block--media" />
          </div>

          <div className="detail-loading-stack detail-loading-stack--article">
            <span className="detail-loading-block detail-loading-block--paragraph" />
            <span className="detail-loading-block detail-loading-block--paragraph" />
            <span className="detail-loading-block detail-loading-block--paragraph" />
            <span className="detail-loading-block detail-loading-block--paragraph detail-loading-block--paragraph-short" />
            <span className="detail-loading-block detail-loading-block--section-title" />
            <span className="detail-loading-block detail-loading-block--paragraph" />
            <span className="detail-loading-block detail-loading-block--paragraph" />
            <span className="detail-loading-block detail-loading-block--paragraph detail-loading-block--paragraph-medium" />
          </div>
        </article>

        <aside className="detail-sidebar">
          <div className="detail-panel detail-loading-panel">
            <span className="detail-loading-block detail-loading-block--eyebrow" />
            <span className="detail-loading-block detail-loading-block--summary-md" />
            <span className="detail-loading-block detail-loading-block--summary-sm" />
            <span className="detail-loading-block detail-loading-block--summary-sm" />
          </div>

          <div className="detail-panel detail-loading-panel">
            <span className="detail-loading-block detail-loading-block--eyebrow" />
            <span className="detail-loading-block detail-loading-block--summary-md" />
            <span className="detail-loading-block detail-loading-block--summary-sm" />
          </div>
        </aside>
      </div>
    </div>
  );
}

const CONTACT_EMAIL = "contact@example.com";

type StaticSection = {
  title: string;
  body: Array<ReactNode>;
};

function resolveRelatedLinkTitle(link: Post["relatedLinks"][number]) {
  if (link.title?.trim()) {
    return link.title.trim();
  }

  if (link.siteName?.trim()) {
    return link.siteName.trim();
  }

  try {
    return new URL(link.url).hostname.replace(/^www\./, "");
  } catch {
    return link.url;
  }
}

function RelatedLinksSection(props: { links?: Post["relatedLinks"] }) {
  const links = props.links?.filter((link) => link.url?.trim()) ?? [];

  if (!links.length) {
    return null;
  }

  return (
    <section className="detail-related-links">
      <SectionHeader
        eyebrow="관련 링크"
        title="본문 밖에서 더 읽기"
        description="본문 아래에 저장된 링크 카드만 노출합니다. 외부 페이지를 다시 수집하지 않고 저장된 스냅샷만 사용합니다."
      />
      <div className="related-link-list">
        {links.map((link, index) => (
          <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noreferrer" className="related-link-card">
            <div className="related-link-card__media">
              {link.image ? <img src={link.image} alt={resolveRelatedLinkTitle(link)} loading="lazy" /> : <span>링크</span>}
            </div>
            <div className="related-link-card__body">
              <p className="related-link-card__source">{link.siteName || resolveRelatedLinkTitle(link)}</p>
              <h3 className="related-link-card__title">{resolveRelatedLinkTitle(link)}</h3>
              {link.description ? <p className="related-link-card__description">{link.description}</p> : null}
              <p className="related-link-card__url">{link.url}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function StaticInfoPage(props: {
  title: string;
  description: string;
  path: string;
  eyebrow: string;
  sections: StaticSection[];
}) {
  const siteSettings = useSiteSettings();

  usePageMetadata({
    title: `${props.title} | ${siteSettings.branding.siteTitle}`,
    description: props.description,
    path: props.path,
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createWebPageStructuredData({
      name: `${props.title} | ${siteSettings.branding.siteTitle}`,
      description: props.description,
      path: props.path,
      breadcrumbs: [
        { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
        { name: props.title, path: props.path },
      ],
    }),
  });

  return (
    <div className="editorial-page info-page">
      <BreadcrumbTrail
        items={[
          { label: siteSettings.branding.siteTitle, href: withKoPath("/") },
          { label: props.title },
        ]}
      />
      <section className="page-hero">
        <div className="page-hero__copy">
          <p className="section-header__eyebrow">{props.eyebrow}</p>
          <h1 className="page-hero__title">{props.title}</h1>
          <p className="page-hero__description">{props.description}</p>
        </div>
      </section>
      <section className="editorial-section info-page__stack">
        {props.sections.map((section) => (
          <article key={section.title} className="detail-panel info-page__section">
            <h2 className="info-page__title">{section.title}</h2>
            <div className="info-page__content">
              {section.body.map((paragraph, index) => (
                <p key={`${section.title}-${index}`}>{paragraph}</p>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <StaticInfoPage
      title="개인정보처리방침"
      description="동그리아카이브가 수집하는 최소한의 정보와 처리 방식을 안내합니다."
      path={withKoPath("/privacy")}
      eyebrow="정책"
      sections={[
        {
          title: "수집 정보",
          body: [
            "공개 블로그 열람 자체만으로 회원 가입 정보는 수집하지 않습니다.",
            "운영 과정에서 접속 로그, 보안 로그, 댓글 시스템 연동 정보처럼 서비스 유지에 필요한 최소 정보가 처리될 수 있습니다.",
          ],
        },
        {
          title: "이용 목적",
          body: [
            "사이트 운영, 보안 대응, 오류 추적, 문의 응대, 저작권 및 정정 요청 처리에 사용합니다.",
          ],
        },
      ]}
    />
  );
}

export function PreDeployTestPage() {
  const siteSettings = useSiteSettings();
  const items = [
    { label: "홈", path: withKoPath("/") },
    { label: "소개", path: withKoPath("/about") },
    { label: "문의", path: withKoPath("/contact") },
    { label: "개인정보처리방침", path: withKoPath("/privacy") },
    { label: "이용조건", path: withKoPath("/terms") },
    { label: "면책 고지", path: withKoPath("/disclaimer") },
    { label: "편집 정책", path: withKoPath("/editorial-policy") },
    { label: "검색", path: withKoPath("/search") },
    { label: "RSS", path: withKoPath("/rss.xml") },
    { label: "사이트맵", path: withKoPath("/sitemap.xml") },
  ];

  usePageMetadata({
    title: `배포 전 테스트 | ${siteSettings.branding.siteTitle}`,
    description: "배포 전 공개 페이지/정책 페이지/피드 동작을 빠르게 확인하기 위한 내부 점검 페이지입니다.",
    path: withKoPath("/test-preview"),
    robots: "noindex,nofollow",
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createWebPageStructuredData({
      name: `배포 전 테스트 | ${siteSettings.branding.siteTitle}`,
      description: "배포 전 공개 페이지/정책 페이지/피드 동작을 빠르게 확인하기 위한 내부 점검 페이지입니다.",
      path: withKoPath("/test-preview"),
      breadcrumbs: [
        { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
        { name: "배포 전 테스트", path: withKoPath("/test-preview") },
      ],
    }),
  });

  return (
    <div className="editorial-page">
      <BreadcrumbTrail
        items={[
          { label: siteSettings.branding.siteTitle, href: withKoPath("/") },
          { label: "배포 전 테스트" },
        ]}
      />

      <section className="page-hero">
        <div className="page-hero__copy">
          <p className="section-header__eyebrow">검증</p>
          <h1 className="page-hero__title">배포 전 체크 페이지</h1>
          <p className="page-hero__description">
            주요 공개 페이지 진입, 정책 페이지 연결, 피드/사이트맵 응답을 배포 전에 빠르게 확인합니다.
          </p>
        </div>
      </section>

      <section className="editorial-section">
        <div className="about-grid">
          {items.map((item) => (
            <article key={item.path} className="about-card">
              <div className="about-card__head">
                <div>
                  <p className="section-header__eyebrow">체크 링크</p>
                  <h3 className="about-card__title">{item.label}</h3>
                </div>
                <Link to={item.path} className="section-header__action">
                  <span>열기</span>
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              <p className="about-card__description">{item.path}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ContactPage() {
  return (
    <StaticInfoPage
      title="문의"
      description="운영 문의와 정정, 삭제, 저작권 요청은 공식 이메일로 전달해 주세요."
      path={withKoPath("/contact")}
      eyebrow="연락"
      sections={[
        {
          title: "운영 이메일",
          body: [
            <>
              공식 문의 주소:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="inline-link">
                {CONTACT_EMAIL}
              </a>
            </>,
            "정정, 삭제, 저작권 요청은 대상 URL과 요청 사유를 함께 보내 주세요.",
          ],
        },
        {
          title: "응답 범위",
          body: [
            "사이트 운영 문의, 오기 수정, 링크 오류, 저작권 관련 연락을 우선 확인합니다.",
            "간단한 문의보다 사실 확인이 필요한 요청부터 순서대로 검토합니다.",
          ],
        },
      ]}
    />
  );
}

export function TermsPage() {
  return (
    <StaticInfoPage
      title="이용조건"
      description="동그리아카이브 콘텐츠 이용 시 기본 원칙을 안내합니다."
      path={withKoPath("/terms")}
      eyebrow="정책"
      sections={[
        {
          title: "콘텐츠 이용",
          body: [
            "사이트의 글, 이미지, 편집 구성은 별도 허락 없이 무단 복제하거나 재배포할 수 없습니다.",
            "인용 시에는 출처와 원문 링크를 함께 표시해 주세요.",
          ],
        },
      ]}
    />
  );
}

export function DisclaimerPage() {
  return (
    <StaticInfoPage
      title="면책 고지"
      description="기록과 해설 콘텐츠의 해석 범위를 분명히 하기 위한 안내입니다."
      path={withKoPath("/disclaimer")}
      eyebrow="정책"
      sections={[
        {
          title: "콘텐츠 성격",
          body: [
            "동그리아카이브의 글은 조사, 정리, 해설을 위한 콘텐츠이며 법률, 의료, 투자 자문을 대신하지 않습니다.",
            "외부 링크와 인용 자료는 작성 시점 기준으로 검토하지만, 이후 변경될 수 있습니다.",
          ],
        },
      ]}
    />
  );
}

export function EditorialPolicyPage() {
  return (
    <StaticInfoPage
      title="편집 정책"
      description="동그리아카이브가 글을 선택하고 정리하는 기준을 공개합니다."
      path={withKoPath("/editorial-policy")}
      eyebrow="편집 원칙"
      sections={[
        {
          title: "기본 원칙",
          body: [
            "사실과 해석을 구분해 작성하고, 확인 가능한 출처가 있을 때 우선 반영합니다.",
            "루트 카테고리와 하위 카테고리의 맥락을 분리해 독자가 흐름을 따라가도록 구성합니다.",
          ],
        },
      ]}
    />
  );
}

export function NotFoundPage() {
  const siteSettings = useSiteSettings();

  usePageMetadata({
    title: `페이지를 찾을 수 없음 | ${siteSettings.branding.siteTitle}`,
    description: "요청한 페이지를 찾지 못했습니다.",
    path: withKoPath("/404"),
    robots: "noindex,nofollow",
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createWebPageStructuredData({
      name: `페이지를 찾을 수 없음 | ${siteSettings.branding.siteTitle}`,
      description: "요청한 페이지를 찾지 못했습니다.",
      path: withKoPath("/404"),
      breadcrumbs: [
        { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
        { name: "404", path: withKoPath("/404") },
      ],
    }),
  });

  return (
    <div className="editorial-page">
      <section className="page-hero">
        <div className="page-hero__copy">
          <p className="section-header__eyebrow">404</p>
          <h1 className="page-hero__title">요청한 페이지를 찾을 수 없습니다</h1>
          <p className="page-hero__description">주소를 다시 확인하거나 홈, 카테고리, 검색으로 이동해 주세요.</p>
          <div className="feed-callout__actions">
            <Link to={withKoPath("/")} className="feed-callout__link">홈으로</Link>
            <Link to={withKoPath("/search")} className="feed-callout__link">검색</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
export function WorkerResourceRedirectPage(props: { title: string; resourcePath: string }) {
  const siteSettings = useSiteSettings();
  const resourceUrl = getWorkerResourceUrl(props.resourcePath);

  usePageMetadata({
    title: `${props.title} | ${siteSettings.branding.siteTitle}`,
    description: `${props.title}는 Worker에서 직접 제공하는 리소스입니다.`,
    path: withKoPath(props.resourcePath),
    robots: "noindex,follow",
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createWebPageStructuredData({
      name: `${props.title} | ${siteSettings.branding.siteTitle}`,
      description: `${props.title}는 Worker에서 직접 제공하는 리소스입니다.`,
      path: withKoPath(props.resourcePath),
      breadcrumbs: [
        { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
        { name: props.title, path: withKoPath(props.resourcePath) },
      ],
    }),
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.replace(resourceUrl);
    }
  }, [resourceUrl]);

  return (
    <div className="editorial-page">
      <BreadcrumbTrail
        items={[
          { label: siteSettings.branding.siteTitle, href: withKoPath("/") },
          { label: props.title },
        ]}
      />

      <section className="page-hero">
        <div className="page-hero__copy">
          <p className="section-header__eyebrow">{props.title}</p>
          <h1 className="page-hero__title">{props.title} 리소스로 이동합니다</h1>
          <p className="page-hero__description">
            이 경로는 실제 XML 응답을 반환하는 Worker endpoint로 바로 연결됩니다.
          </p>
        </div>
        <aside className="page-hero__rail">
          <div className="detail-panel">
            <p className="section-header__eyebrow">Direct URL</p>
            <div className="detail-panel__links">
              <a href={resourceUrl} className="detail-panel__link">
                {resourceUrl}
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}



