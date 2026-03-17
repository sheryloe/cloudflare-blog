import type { Category, CategoryFeed, Post, PostSummary, TagFeed } from "@donggeuri/shared";
import { ArrowUpRight, MoveRight } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useParams, useSearchParams } from "react-router-dom";

import { extractTocHeadings, MarkdownContent } from "./components/markdown-content";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  getCategoryFeed,
  getPost,
  getTagFeed,
  getWorkerResourceUrl,
  listCategories,
  listPosts,
  searchPosts,
} from "./lib/api";
import { cn } from "./lib/utils";
import { ErrorMessage } from "./ui";

const RSS_FEED_URL = "/rss.xml";
const SITEMAP_URL = "/sitemap.xml";
const SITE_TITLE = "Donggri 기록들";
const SITE_TAGLINE = "잠시 머물며 마음은 쉬고, 필요한 지식 한 줄은 조용히 가져가는 기록 서가입니다.";
const SITE_DESCRIPTION =
  "메인에는 새 글이 먼저 놓이고, 오른쪽에는 정보의 기록, 세상의 기록, 시장의 기록, 기술의 기록, 동그리의 기록이 트리로 정리됩니다. 문화와 축제, 역사와 이슈, 주식과 크립토, 신기술, 개발, 여행, 일상을 한 번에 파악할 수 있게 분류한 기록 블로그입니다.";
const ABOUT_DESCRIPTION =
  "문화, 축제, 행사, 역사, 다큐, 미스터리, 주식, 크립토, 신기술, 개발, 여행, 일상을 차분한 문장으로 엮어두는 Donggri 기록들의 공개 소개 페이지입니다.";

const publicLinks = [
  { href: "/", label: "홈", external: false },
  { href: "/about", label: "소개", external: false },
  { href: "/search", label: "검색", external: false },
];

const pageDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const ARCHIVE_GROUPS = [
  {
    eyebrow: "정보의 기록",
    title: "문화, 축제, 행사를 보기 좋게 정리합니다.",
    description:
      "문화 공간, 계절 축제, 각종 행사를 다시 찾기 쉽게 정리하는 갈래입니다. 장소 분위기와 일정, 포인트를 한눈에 훑을 수 있게 남깁니다.",
    items: ["문화와 공간", "축제와 시즌", "행사와 현장"],
  },
  {
    eyebrow: "세상의 기록",
    title: "역사, 이슈, 미스터리를 맥락 있게 정리합니다.",
    description:
      "역사와 문화, 오늘의 이슈, 미스터리와 전설을 배경과 해설까지 붙여 정리하는 갈래입니다. 흥미만 남기지 않고 맥락까지 같이 남깁니다.",
    items: ["역사와 문화", "이슈와 해설", "미스터리와 전설"],
  },
  {
    eyebrow: "시장의 기록",
    title: "주식과 크립토를 흐름 중심으로 읽습니다.",
    description:
      "짧은 등락보다 주식과 크립토의 흐름, 배경, 리스크를 기록하는 갈래입니다. 나중에 다시 꺼내 볼 기준점을 남기는 쪽에 가깝습니다.",
    items: ["주식의 흐름", "크립토의 흐름"],
  },
  {
    eyebrow: "기술의 기록",
    title: "신기술, 리뷰, 분석 글을 다시 보기 좋게 남깁니다.",
    description:
      "새 기술 소식, 전문 유튜브 리뷰, 좋은 글 분석을 핵심과 해설 중심으로 정리합니다. 실무 감각으로 다시 참고하기 좋은 메모를 지향합니다.",
    items: ["신기술과 도구", "유튜브 리뷰", "글 분석과 해설"],
  },
  {
    eyebrow: "동그리의 기록",
    title: "개발, 여행, 일상을 동그리의 방식으로 기록합니다.",
    description:
      "개발하는 일과 프로그래밍, 여행에서 본 장면, 일상에서 남긴 메모를 동그리의 시선으로 적어두는 갈래입니다. 가볍게 흘려보내기보다 차분히 남깁니다.",
    items: ["개발과 프로그래밍", "여행과 기록", "일상과 메모"],
  },
] as const;

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

function parseYoutubeVideo(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");
    let id = "";

    if (hostname === "youtu.be") {
      id = url.pathname.slice(1);
    } else if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      if (url.pathname === "/watch") {
        id = url.searchParams.get("v") ?? "";
      } else if (url.pathname.startsWith("/embed/")) {
        id = url.pathname.split("/").at(-1) ?? "";
      } else if (url.pathname.startsWith("/shorts/")) {
        id = url.pathname.split("/").at(-1) ?? "";
      }
    }

    return id || null;
  } catch {
    return null;
  }
}

function buildCategoryTree(categories: Category[]) {
  const items = [...categories].sort((left, right) => left.name.localeCompare(right.name, "ko"));
  const byId = new Map(items.map((category) => [category.id, category]));
  const children = new Map<string, Category[]>();
  const roots: Category[] = [];

  items.forEach((category) => {
    if (category.parentId && byId.has(category.parentId)) {
      children.set(category.parentId, [...(children.get(category.parentId) ?? []), category]);
      return;
    }

    roots.push(category);
  });

  return roots.map((category) => ({
    category,
    children: (children.get(category.id) ?? []).sort((left, right) => left.name.localeCompare(right.name, "ko")),
  }));
}

function upsertMetaTag(selector: string, attributes: Record<string, string>, content: string) {
  if (typeof document === "undefined") {
    return;
  }

  let element = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function usePageMetadata(title: string, description: string) {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.title = title;
    upsertMetaTag('meta[name="description"]', { name: "description" }, description);
    upsertMetaTag('meta[property="og:title"]', { property: "og:title" }, title);
    upsertMetaTag('meta[property="og:description"]', { property: "og:description" }, description);
    upsertMetaTag('meta[name="twitter:title"]', { name: "twitter:title" }, title);
    upsertMetaTag('meta[name="twitter:description"]', { name: "twitter:description" }, description);
  }, [title, description]);
}

function NavigationLink(props: { href: string; label: string; external?: boolean }) {
  const location = useLocation();
  const isActive =
    !props.external && (props.href === "/" ? location.pathname === "/" : location.pathname.startsWith(props.href));

  if (props.external) {
    return (
      <a href={props.href} className="simple-nav-link">
        {props.label}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    );
  }

  return (
    <Link to={props.href} className={cn("simple-nav-link", isActive && "simple-nav-link-active")}>
      {props.label}
    </Link>
  );
}

function CategoryChip(props: { category?: Category | null; fallback?: string }) {
  return <span className="simple-chip">{props.category?.name ?? props.fallback ?? "미분류"}</span>;
}

function ArchiveGroupCard(props: (typeof ARCHIVE_GROUPS)[number]) {
  return (
    <article className="topic-card">
      <p className="sidebar-box__eyebrow">{props.eyebrow}</p>
      <h3 className="topic-card__title">{props.title}</h3>
      <p className="topic-card__text">{props.description}</p>
      <div className="topic-card__tags">
        {props.items.map((item) => (
          <span key={item} className="simple-chip">
            {item}
          </span>
        ))}
      </div>
    </article>
  );
}

function PostListItem(props: { post: PostSummary }) {
  return (
    <article className="post-row">
      <div className="post-row__body">
        <div className="post-row__meta">
          <CategoryChip category={props.post.category} />
          <span>{formatDate(props.post.publishedAt ?? props.post.updatedAt)}</span>
        </div>
        <Link to={`/post/${props.post.slug}`} className="post-row__title">
          {props.post.title}
        </Link>
        <p className="post-row__summary">{props.post.excerpt || props.post.subtitle || props.post.slug}</p>
        <Link to={`/post/${props.post.slug}`} className="simple-inline-link">
          자세히 보기
          <MoveRight className="h-4 w-4" />
        </Link>
      </div>
      {props.post.coverImage ? (
        <Link to={`/post/${props.post.slug}`} className="post-row__thumb">
          <img src={props.post.coverImage} alt={props.post.title} />
        </Link>
      ) : null}
    </article>
  );
}

function SidebarCategoryTree(props: { categories: Category[] }) {
  const tree = useMemo(() => buildCategoryTree(props.categories), [props.categories]);

  if (!tree.length) {
    return (
      <div className="sidebar-tree">
        {ARCHIVE_GROUPS.map((group) => (
          <div key={group.eyebrow} className="sidebar-tree__branch">
            <div className="sidebar-tree__parent sidebar-tree__parent-static">{group.eyebrow}</div>
            <div className="sidebar-tree__children">
              {group.items.map((item) => (
                <div key={item} className="sidebar-tree__child sidebar-tree__child-static">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="sidebar-tree">
      {tree.map((node) => (
        <div key={node.category.id} className="sidebar-tree__branch">
          <Link to={`/category/${node.category.slug}`} className="sidebar-tree__parent">
            <span>{node.category.name}</span>
            <MoveRight className="h-4 w-4" />
          </Link>
          {node.children.length ? (
            <div className="sidebar-tree__children">
              {node.children.map((child) => (
                <Link key={child.id} to={`/category/${child.slug}`} className="sidebar-tree__child">
                  <span>{child.name}</span>
                  <MoveRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Sidebar(props: { categories: Category[] }) {
  return (
    <aside className="simple-sidebar">
      <section className="sidebar-box">
        <p className="sidebar-box__eyebrow">{SITE_TITLE}</p>
        <h2 className="sidebar-box__title">쉬어 읽는 동안, 하나쯤 가져갈 만한 문장을 모아두는 곳입니다.</h2>
        <p className="sidebar-box__text">
          잠깐 머무는 동안에도 작은 정보와 잔잔한 여운이 함께 남도록 기록합니다. 새 글은 앞에 놓고, 기록의 갈래는 옆에서 조용히 읽을 길을 이어 둡니다.
        </p>
      </section>

      <section className="sidebar-box">
        <p className="sidebar-box__eyebrow">기록의 갈래</p>
        <SidebarCategoryTree categories={props.categories} />
      </section>

      <section className="sidebar-box">
        <p className="sidebar-box__eyebrow">피드</p>
        <div className="sidebar-link-list">
          <a href={RSS_FEED_URL} className="sidebar-link-row">
            <span>RSS 피드</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
          <a href={SITEMAP_URL} className="sidebar-link-row">
            <span>사이트맵 XML</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </aside>
  );
}

function ArchiveHeader(props: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="archive-header">
      <p className="archive-header__eyebrow">{props.eyebrow}</p>
      <h1 className="archive-header__title">{props.title}</h1>
      <p className="archive-header__description">{props.description}</p>
    </header>
  );
}

function VideoEmbed(props: { title: string; youtubeUrl: string }) {
  const videoId = parseYoutubeVideo(props.youtubeUrl);

  if (!videoId) {
    return null;
  }

  return (
    <section className="video-box">
      <p className="sidebar-box__eyebrow">관련 영상</p>
      <div className="video-box__frame">
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

function TableOfContents(props: { content: string; activeHeading: string }) {
  const headings = useMemo(() => extractTocHeadings(props.content), [props.content]);

  if (!headings.length) {
    return null;
  }

  return (
    <aside className="article-toc">
      <p className="sidebar-box__eyebrow">목차</p>
      <nav className="article-toc__list">
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={cn(
              "article-toc__link",
              heading.level === 3 && "article-toc__link-sub",
              props.activeHeading === heading.id && "article-toc__link-active",
            )}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}

export function PublicLayout() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    void listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  return (
    <div className="simple-shell">
      <header className="simple-header">
        <div className="simple-header__brand">
          <Link to="/" className="simple-brand">
            {SITE_TITLE}
          </Link>
          <p className="simple-brand__description">{SITE_TAGLINE}</p>
        </div>
        <nav className="simple-nav">
          {publicLinks.map((item) => (
            <NavigationLink key={item.href} href={item.href} label={item.label} external={item.external} />
          ))}
        </nav>
      </header>

      <main className="simple-grid">
        <div className="simple-main">
          <Outlet />
        </div>
        <Sidebar categories={categories} />
      </main>
    </div>
  );
}

export function HomePage() {
  usePageMetadata(SITE_TITLE, SITE_DESCRIPTION);

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listPosts()
      .then((items) => {
        setPosts(items);
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const [featured, ...rest] = posts;

  return (
    <div className="simple-page">
      <ErrorMessage message={error} />

      <ArchiveHeader
        eyebrow="블로그"
        title="쉬어 읽는 사이, 작은 지식과 오래 남는 문장이 차분히 놓이는 곳"
        description="메인에는 막 도착한 글을 먼저 두고, 오른쪽 갈래는 서가처럼 천천히 길을 잡아둡니다. 가볍게 머물러도 하나쯤 얻어갈 수 있는 기록 블로그를 지향합니다."
      />

      {featured ? (
        <article className="featured-post">
          <div className="featured-post__body">
            <div className="post-row__meta">
              <CategoryChip category={featured.category} fallback="최신 글" />
              <span>{formatDate(featured.publishedAt ?? featured.updatedAt)}</span>
            </div>
            <Link to={`/post/${featured.slug}`} className="featured-post__title">
              {featured.title}
            </Link>
            <p className="featured-post__summary">
              {featured.excerpt || featured.subtitle || "가장 최근에 올라온 글을 먼저 읽기 좋은 위치에 두었습니다."}
            </p>
            <Button asChild className="simple-primary-button">
              <Link to={`/post/${featured.slug}`}>
                글 읽기
                <MoveRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          {featured.coverImage ? (
            <Link to={`/post/${featured.slug}`} className="featured-post__media">
              <img src={featured.coverImage} alt={featured.title} />
            </Link>
          ) : null}
        </article>
      ) : (
        <div className="empty-box">아직 공개된 글이 없습니다. 관리자에서 첫 글을 작성하면 이곳에 가장 먼저 보입니다.</div>
      )}

      <section className="list-section">
        <div className="list-section__header">
          <h2>최신 글 목록</h2>
          <p>최근에 올라온 글을 위에서 아래로 차례로 읽을 수 있게 정리했습니다.</p>
        </div>
        {rest.length ? (
          <div className="post-list">
            {rest.map((post) => (
              <PostListItem key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="empty-box">첫 글 뒤에 이어지는 목록은 새 글이 쌓이면서 자연스럽게 채워집니다.</div>
        )}
      </section>
    </div>
  );
}

export function PostPage() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeHeading, setActiveHeading] = useState("");
  const [progress, setProgress] = useState(0);

  usePageMetadata(
    post ? `${post.title} | ${SITE_TITLE}` : `글 불러오는 중 | ${SITE_TITLE}`,
    post?.excerpt ?? post?.subtitle ?? SITE_DESCRIPTION,
  );

  useEffect(() => {
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
    if (!post) {
      return;
    }

    const headings = extractTocHeadings(post.content);

    const updateReadingState = () => {
      const documentElement = document.documentElement;
      const maxScroll = documentElement.scrollHeight - documentElement.clientHeight;
      const nextProgress = maxScroll > 0 ? Math.min(100, (window.scrollY / maxScroll) * 100) : 0;
      setProgress(nextProgress);

      if (!headings.length) {
        setActiveHeading("");
        return;
      }

      let current = headings[0]?.id ?? "";

      for (const heading of headings) {
        const element = document.getElementById(heading.id);

        if (element && element.getBoundingClientRect().top <= 120) {
          current = heading.id;
        }
      }

      setActiveHeading(current);
    };

    updateReadingState();
    window.addEventListener("scroll", updateReadingState, { passive: true });
    window.addEventListener("resize", updateReadingState);

    return () => {
      window.removeEventListener("scroll", updateReadingState);
      window.removeEventListener("resize", updateReadingState);
    };
  }, [post]);

  return (
    <div className="simple-page">
      <ErrorMessage message={error} />
      <div className="simple-reading-progress" aria-hidden="true">
        <span className="simple-reading-progress__bar" style={{ width: `${progress}%` }} />
      </div>

      <article className="article-page">
        <header className="article-page__header">
          <div className="post-row__meta">
            <CategoryChip category={post?.category} />
            <span>{formatDate(post?.publishedAt ?? post?.updatedAt)}</span>
            <span>{post ? `${estimateReadMinutes(post.content)}분 읽기` : ""}</span>
          </div>
          <h1>{post?.title ?? "글 불러오는 중"}</h1>
          {post?.subtitle || post?.excerpt ? (
            <p className="article-page__summary">{post.excerpt || post.subtitle}</p>
          ) : null}
          <div className="article-page__actions">
            <Link to="/" className="simple-inline-link">
              목록으로 돌아가기
            </Link>
            {post?.tags.length ? (
              <div className="article-tags">
                {post.tags.map((tag) => (
                  <Link key={tag.id} to={`/tag/${tag.slug}`} className="simple-chip">
                    #{tag.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        {post?.coverImage ? (
          <div className="article-cover">
            <img src={post.coverImage} alt={post.title} />
          </div>
        ) : null}

        {post?.youtubeUrl ? <VideoEmbed title={post.title} youtubeUrl={post.youtubeUrl} /> : null}

        <div className="article-layout">
          <div className="article-content-wrap">
            {post ? <MarkdownContent content={post.content} /> : <div className="empty-box">요청한 글을 불러오지 못했습니다.</div>}
          </div>
          {post ? <TableOfContents content={post.content} activeHeading={activeHeading} /> : null}
        </div>
      </article>
    </div>
  );
}

export function CategoryArchivePage() {
  const { slug = "" } = useParams();
  const [feed, setFeed] = useState<CategoryFeed | null>(null);
  const [error, setError] = useState<string | null>(null);

  usePageMetadata(
    feed ? `${feed.category.name} | ${SITE_TITLE}` : `기록의 갈래 | ${SITE_TITLE}`,
    feed?.category.description ?? "주제별로 묶인 글을 모아보는 페이지입니다.",
  );

  useEffect(() => {
    void getCategoryFeed(slug)
      .then((value) => {
        setFeed(value);
        setError(null);
      })
      .catch((reason: Error) => {
        setFeed(null);
        setError(reason.message);
      });
  }, [slug]);

  return (
    <div className="simple-page">
      <ErrorMessage message={error} />
      <ArchiveHeader
        eyebrow="기록의 갈래"
        title={feed?.category.name ?? "기록의 갈래"}
        description={feed?.category.description ?? "선택한 갈래에 속한 글을 한곳에 모아둔 목록입니다."}
      />
      {feed?.posts.length ? (
        <div className="post-list">
          {feed.posts.map((post) => (
            <PostListItem key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="empty-box">이 갈래에는 아직 공개된 글이 없습니다.</div>
      )}
    </div>
  );
}

export function TagArchivePage() {
  const { slug = "" } = useParams();
  const [feed, setFeed] = useState<TagFeed | null>(null);
  const [error, setError] = useState<string | null>(null);

  usePageMetadata(
    feed ? `#${feed.tag.name} | ${SITE_TITLE}` : `태그 | ${SITE_TITLE}`,
    feed ? `#${feed.tag.name}로 묶인 글 목록입니다.` : "선택한 태그에 연결된 글을 모아보는 페이지입니다.",
  );

  useEffect(() => {
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

  return (
    <div className="simple-page">
      <ErrorMessage message={error} />
      <ArchiveHeader
        eyebrow="태그"
        title={feed ? `#${feed.tag.name}` : "태그"}
        description={feed ? `#${feed.tag.name}로 묶인 글 목록입니다.` : "선택한 태그에 연결된 글을 모아보는 페이지입니다."}
      />
      {feed?.posts.length ? (
        <div className="post-list">
          {feed.posts.map((post) => (
            <PostListItem key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="empty-box">이 태그에는 아직 공개된 글이 없습니다.</div>
      )}
    </div>
  );
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentQuery = searchParams.get("q")?.trim() ?? "";
  const [draft, setDraft] = useState(currentQuery);
  const [results, setResults] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePageMetadata(
    currentQuery ? `"${currentQuery}" 검색 | ${SITE_TITLE}` : `검색 | ${SITE_TITLE}`,
    "행사, 문화, 이슈, 미스터리, 주식, 크립토, AI 같은 키워드로 공개 글의 제목, 요약, 본문, 태그를 검색할 수 있습니다.",
  );

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = draft.trim();

    if (!nextQuery) {
      setSearchParams({}, { replace: true });
      return;
    }

    setSearchParams({ q: nextQuery }, { replace: true });
  };

  return (
    <div className="simple-page">
      <ArchiveHeader
        eyebrow="검색"
        title="떠오른 단어 하나로 관련 기록을 다시 찾기"
        description="공개된 글의 제목, 요약, 본문, 태그를 기준으로 검색합니다. 행사, 미스터리, 비트코인, AI처럼 주제어 하나만 넣어도 관련 글을 다시 모아볼 수 있습니다."
      />

      <form className="search-panel" onSubmit={handleSubmit}>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="예: 축제, 역사, 비트코인, 개발"
          aria-label="검색어"
        />
        <Button type="submit" className="simple-primary-button search-panel__button">
          검색
        </Button>
      </form>

      <ErrorMessage message={error} />

      {currentQuery ? (
        <section className="list-section">
          <div className="list-section__header">
            <h2>{loading ? "검색 중..." : `"${currentQuery}" 검색 결과`}</h2>
            <p>{loading ? "공개 글에서 관련 기록을 찾고 있습니다." : `${results.length}개의 글을 찾았습니다.`}</p>
          </div>

          {results.length ? (
            <div className="post-list">
              {results.map((post) => (
                <PostListItem key={post.id} post={post} />
              ))}
            </div>
          ) : loading ? (
            <div className="empty-box">검색 결과를 불러오는 중입니다.</div>
          ) : (
            <div className="empty-box">일치하는 공개 글이 없습니다. 다른 키워드로 다시 검색해보세요.</div>
          )}
        </section>
      ) : (
        <div className="empty-box">궁금한 주제 하나만 넣어도 관련 기록을 다시 찾을 수 있습니다.</div>
      )}
    </div>
  );
}

export function AboutPage() {
  usePageMetadata(`소개 | ${SITE_TITLE}`, ABOUT_DESCRIPTION);

  return (
    <div className="simple-page">
      <ArchiveHeader
        eyebrow="소개"
        title="문화와 축제, 역사와 이슈, 시장과 기술, 그리고 동그리의 일상을 한곳에 모아둡니다"
        description="Donggri 기록들은 문화, 축제, 행사, 역사, 다큐, 미스터리, 주식, 크립토, 신기술, 개발, 여행, 일상을 차분한 문장으로 엮는 공개 블로그입니다. 가볍게 훑어도 주제가 보이고, 오래 읽으면 맥락이 남는 기록을 지향합니다."
      />

      <section className="featured-post">
        <div className="featured-post__body">
          <div className="post-row__meta">
            <span className="simple-chip">문화와 축제</span>
            <span className="simple-chip">역사와 이슈</span>
            <span className="simple-chip">개발과 여행</span>
          </div>
          <h2 className="featured-post__title">눈길이 머무는 장면부터 오래 붙드는 이야기까지, Donggri 기록들에 차분히 모아둡니다.</h2>
          <p className="featured-post__summary">
            이곳에는 문화와 축제, 행사와 공간, 역사와 다큐, 이슈와 미스터리, 주식과 크립토, 신기술과 개발, 여행과 일상이 함께 쌓입니다.
            검색으로 다시 찾기 좋고, 처음 들어와도 어떤 주제를 다루는지 바로 보이도록 정리했습니다.
          </p>
        </div>

        <div className="grid gap-4">
          <section className="sidebar-box">
            <p className="sidebar-box__eyebrow">기록</p>
            <h3 className="sidebar-box__title">자주 머무는 이야기</h3>
            <p className="sidebar-box__text">
              문화, 축제, 행사, 역사, 다큐, 미스터리, 주식, 크립토, 신기술, 개발, 여행, 일상처럼 하루의 관심사와 오래 남는 주제를 함께 다룹니다.
            </p>
          </section>
          <section className="sidebar-box">
            <p className="sidebar-box__eyebrow">문장</p>
            <h3 className="sidebar-box__title">빠르게 읽혀도, 오래 남게</h3>
            <p className="sidebar-box__text">
              짧게 훑어도 핵심이 잡히고, 길게 읽어도 흐름이 끊기지 않는 글을 지향합니다. 정보성 글과 기록성 글이 한 화면 안에서 자연스럽게 이어집니다.
            </p>
          </section>
        </div>
      </section>

      <section className="list-section">
        <div className="list-section__header">
          <h2>이 블로그에서 만나는 갈래</h2>
          <p>처음 들어와도 어떤 글을 읽게 될지 한눈에 보이도록, 큰 주제와 세부 주제를 차분하게 정리해두었습니다.</p>
        </div>
        <div className="topic-grid">
          {ARCHIVE_GROUPS.map((group) => (
            <ArchiveGroupCard key={group.eyebrow} {...group} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function WorkerResourceRedirectPage(props: { title: string; resourcePath: string }) {
  const resourceUrl = getWorkerResourceUrl(props.resourcePath);

  usePageMetadata(`${props.title} | ${SITE_TITLE}`, `${props.title}은 Worker에서 직접 제공하는 리소스입니다.`);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.replace(resourceUrl);
    }
  }, [resourceUrl]);

  return (
    <div className="simple-page">
      <ArchiveHeader
        eyebrow={props.title}
        title={`${props.title}은 Worker에서 직접 제공합니다.`}
        description="이 경로는 실제 XML 응답을 반환하는 Worker endpoint로 바로 이동합니다."
      />
      <div className="empty-box">
        브라우저가 자동으로 이동하지 않으면 아래 링크를 눌러주세요.
        <div className="mt-4">
          <a href={resourceUrl} className="simple-inline-link">
            {resourceUrl}
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
