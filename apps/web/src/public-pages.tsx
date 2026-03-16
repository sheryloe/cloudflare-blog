import type { Category, CategoryFeed, Post, PostSummary, TagFeed } from "@donggeuri/shared";
import { ArrowUpRight, MoveRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";

import { extractTocHeadings, MarkdownContent } from "./components/markdown-content";
import { Button } from "./components/ui/button";
import { getCategoryFeed, getPost, getTagFeed, listCategories, listPosts } from "./lib/api";
import { cn } from "./lib/utils";
import { ErrorMessage } from "./ui";

const ADMIN_APP_URL = import.meta.env.VITE_ADMIN_APP_URL?.replace(/\/$/, "") ?? "http://localhost:5174";

const publicLinks = [
  { href: "/", label: "홈", external: false },
  { href: "/about", label: "소개", external: false },
  { href: "/search", label: "검색", external: false },
  { href: `${ADMIN_APP_URL}/login`, label: "관리자", external: true },
];

const pageDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

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

    return id ? id : null;
  } catch {
    return null;
  }
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

function Sidebar(props: { categories: Category[] }) {
  return (
    <aside className="simple-sidebar">
      <section className="sidebar-box">
        <p className="sidebar-box__eyebrow">Donggeuri</p>
        <h2 className="sidebar-box__title">읽기 편한 구조에 집중한 블로그</h2>
        <p className="sidebar-box__text">
          장식을 줄이고, 글 제목과 요약, 카테고리, 발행일이 또렷하게 보이도록 정리했습니다. 글 작성은 관리자 화면에서
          진행할 수 있습니다.
        </p>
        <a href={`${ADMIN_APP_URL}/login`} className="simple-inline-link">
          관리자 로그인
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </section>

      <section className="sidebar-box">
        <p className="sidebar-box__eyebrow">카테고리</p>
        {props.categories.length ? (
          <div className="sidebar-link-list">
            {props.categories.map((category) => (
              <Link key={category.id} to={`/category/${category.slug}`} className="sidebar-link-row">
                <span>{category.name}</span>
                <MoveRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="sidebar-box__text">카테고리가 아직 없습니다.</p>
        )}
      </section>

      <section className="sidebar-box">
        <p className="sidebar-box__eyebrow">운영 메모</p>
        <p className="sidebar-box__text">
          글 상세에서는 긴 글을 위한 목차를 유지하고, 홈은 티스토리나 워드프레스처럼 차분한 리스트 중심으로 정리했습니다.
        </p>
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
            Donggeuri
          </Link>
          <p className="simple-brand__description">읽기 편한 구조, 차분한 목록, 긴 글에도 버티는 가독성.</p>
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
        title="과한 장식 대신 글이 먼저 보이는 구조"
        description="최신 글을 상단에 두고, 나머지는 읽기 쉬운 리스트로 정리했습니다. 카테고리와 발행일만 또렷하게 보이도록 단순화했습니다."
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
              {featured.excerpt || featured.subtitle || "가장 최근에 발행된 글을 상단에서 바로 읽을 수 있도록 배치했습니다."}
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
        <div className="empty-box">아직 공개된 글이 없습니다. 관리자에서 첫 글을 작성하면 이곳에 표시됩니다.</div>
      )}

      <section className="list-section">
        <div className="list-section__header">
          <h2>전체 글</h2>
          <p>최신 순으로 정렬된 글 목록입니다.</p>
        </div>
        {rest.length ? (
          <div className="post-list">
            {rest.map((post) => (
              <PostListItem key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="empty-box">첫 글 외에 추가 글이 생기면 이 목록에 차례로 쌓입니다.</div>
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
              홈으로 돌아가기
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
        eyebrow="카테고리"
        title={feed?.category.name ?? "카테고리"}
        description={feed?.category.description ?? "선택한 카테고리에 속한 글 목록입니다."}
      />
      {feed?.posts.length ? (
        <div className="post-list">
          {feed.posts.map((post) => (
            <PostListItem key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="empty-box">이 카테고리에 공개된 글이 아직 없습니다.</div>
      )}
    </div>
  );
}

export function TagArchivePage() {
  const { slug = "" } = useParams();
  const [feed, setFeed] = useState<TagFeed | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        description={feed ? `#${feed.tag.name}로 묶인 글입니다.` : "선택한 태그의 글 목록입니다."}
      />
      {feed?.posts.length ? (
        <div className="post-list">
          {feed.posts.map((post) => (
            <PostListItem key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="empty-box">이 태그에 공개된 글이 아직 없습니다.</div>
      )}
    </div>
  );
}

export function StaticInfoPage(props: { title: string; description: string }) {
  return (
    <div className="simple-page">
      <ArchiveHeader eyebrow={props.title} title={props.title} description={props.description} />
      <div className="empty-box">이 페이지는 아직 준비 중입니다.</div>
    </div>
  );
}
