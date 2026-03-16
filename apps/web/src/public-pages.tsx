import type { Category, CategoryFeed, Post, PostSummary, TagFeed } from "@donggeuri/shared";
import { Menu, MoveRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";

import { MarkdownContent } from "./components/markdown-content";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./components/ui/sheet";
import { getCategoryFeed, getPost, getTagFeed, listCategories, listPosts } from "./lib/api";
import { cn } from "./lib/utils";
import { ErrorMessage, formatDate } from "./ui";

const ADMIN_APP_URL = import.meta.env.VITE_ADMIN_APP_URL?.replace(/\/$/, "") ?? "http://localhost:5174";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/search", label: "Search" },
  { href: `${ADMIN_APP_URL}/login`, label: "Admin", external: true },
];

function statusVariant(status: PostSummary["status"]) {
  if (status === "published") {
    return "published";
  }
  if (status === "draft") {
    return "draft";
  }
  return "archived";
}

function PostMeta(props: { post: Pick<PostSummary, "status" | "publishedAt" | "updatedAt">; compact?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 text-sm text-[var(--color-soft-ink)]", props.compact && "gap-2 text-xs")}>
      <Badge variant={statusVariant(props.post.status)}>{props.post.status}</Badge>
      <span>{formatDate(props.post.publishedAt ?? props.post.updatedAt)}</span>
    </div>
  );
}

function EditorialPostCard(props: { post: PostSummary; featured?: boolean }) {
  return (
    <Card className={cn("overflow-hidden", props.featured ? "grid gap-0 lg:grid-cols-[1.2fr_0.8fr]" : "")}>
      {props.post.coverImage ? (
        <div className={cn("relative overflow-hidden", props.featured ? "min-h-[340px]" : "aspect-[16/10]")}>
          <img
            src={props.post.coverImage}
            alt={props.post.title}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
          />
        </div>
      ) : null}
      <CardContent className={cn("flex flex-col gap-5 p-6", props.featured && "justify-center p-8 lg:p-10")}>
        <p className="section-kicker">{props.featured ? "Featured story" : "Published note"}</p>
        <div className="space-y-3">
          <Link
            to={`/post/${props.post.slug}`}
            className={cn(
              "block text-balance font-semibold tracking-tight text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)]",
              props.featured ? "text-4xl leading-tight sm:text-5xl" : "text-2xl leading-tight",
            )}
          >
            {props.post.title}
          </Link>
          {props.post.subtitle || props.post.excerpt ? (
            <p className="max-w-2xl text-base leading-7 text-[var(--color-soft-ink)]">
              {props.post.excerpt || props.post.subtitle}
            </p>
          ) : null}
        </div>
        <PostMeta post={props.post} />
        <div>
          <Button asChild variant={props.featured ? "default" : "soft"}>
            <Link to={`/post/${props.post.slug}`}>
              Read article
              <MoveRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ArchiveList(props: { posts: PostSummary[]; emptyMessage: string }) {
  if (!props.posts.length) {
    return (
      <div className="rounded-[28px] border border-black/5 bg-white/60 px-5 py-8 text-center text-[var(--color-soft-ink)]">
        {props.emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {props.posts.map((post) => (
        <Card key={post.id} className="overflow-hidden">
          <CardContent className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="space-y-3">
              <Link
                to={`/post/${post.slug}`}
                className="text-xl font-semibold tracking-tight text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)]"
              >
                {post.title}
              </Link>
              {post.excerpt || post.subtitle ? (
                <p className="max-w-2xl text-sm leading-7 text-[var(--color-soft-ink)]">
                  {post.excerpt || post.subtitle}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <PostMeta post={post} compact />
              <Button asChild variant="ghost" size="sm">
                <Link to={`/post/${post.slug}`}>Open</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PublicNav() {
  return (
    <>
      <nav className="hidden items-center gap-2 rounded-full border border-black/5 bg-white/65 p-2 shadow-sm md:flex">
            {publicLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-[var(--color-soft-ink)] hover:bg-black/5 hover:text-[var(--color-ink)]"
              >
                {item.label}
              </a>
            ))}
      </nav>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Donggeuri Blog</SheetTitle>
            <SheetDescription>Navigate the public site and admin workspace.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 grid gap-3">
            {publicLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-2xl bg-[var(--color-paper-muted)] px-4 py-3 text-sm font-medium text-[var(--color-ink)]"
              >
                {item.label}
              </a>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Sidebar(props: { categories: Category[] }) {
  return (
    <aside className="space-y-6">
      <Card className="glass-panel overflow-hidden">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <p className="section-kicker">Browse</p>
            <h3 className="text-2xl font-semibold tracking-tight">Category shelves</h3>
            <p className="text-sm leading-7 text-[var(--color-soft-ink)]">
              Move through the archive like a curated reading room.
            </p>
          </div>
          <div className="grid gap-3">
            {props.categories.map((category) => (
              <Link
                key={category.id}
                to={`/category/${category.slug}`}
                className="rounded-[22px] border border-black/5 bg-white/70 px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:-translate-y-0.5 hover:bg-white"
              >
                {category.name}
              </Link>
            ))}
            {props.categories.length === 0 ? (
              <p className="rounded-[22px] bg-[var(--color-paper-muted)] px-4 py-3 text-sm text-[var(--color-soft-ink)]">
                Categories will appear here once content is organized.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel overflow-hidden">
        <CardContent className="space-y-4 p-6">
          <p className="section-kicker">Reading note</p>
          <p className="text-lg leading-8 text-[var(--color-soft-ink)]">
            The public theme is built to feel like an editorial notebook, not a dashboard.
          </p>
        </CardContent>
      </Card>
    </aside>
  );
}

export function PublicLayout() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    void listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  return (
    <div className="app-shell">
      <header className="mb-6 flex flex-col gap-5 rounded-[36px] border border-black/5 bg-white/60 px-5 py-5 shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur sm:px-7 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="section-kicker">Cloudflare editorial blog</p>
          <div className="space-y-2">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-5xl">
              Stories, notes, and experiments arranged like a quiet magazine.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--color-soft-ink)]">
              Built on Pages, Workers, D1, and R2 with an editorial-first reading experience.
            </p>
          </div>
        </div>
        <PublicNav />
      </header>

      <main className="editorial-grid">
        <div className="space-y-6">
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
  const leadStories = rest.slice(0, 2);
  const archiveStories = rest.slice(2);

  return (
    <div className="space-y-6">
      <ErrorMessage message={error} />
      {featured ? (
        <EditorialPostCard post={featured} featured />
      ) : (
        <Card className="glass-panel overflow-hidden">
          <CardContent className="p-8 text-center text-[var(--color-soft-ink)]">
            Your first published post will become the featured story here.
          </CardContent>
        </Card>
      )}

      {leadStories.length ? (
        <section className="grid gap-6 xl:grid-cols-2">
          {leadStories.map((post) => (
            <EditorialPostCard key={post.id} post={post} />
          ))}
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-2 px-1">
          <p className="section-kicker">Archive</p>
          <h2 className="text-3xl font-semibold tracking-tight">Latest published entries</h2>
          <p className="max-w-2xl text-sm leading-7 text-[var(--color-soft-ink)]">
            A chronological shelf for everything beyond the current features.
          </p>
        </div>
        <ArchiveList posts={archiveStories} emptyMessage="More published posts will appear here." />
      </section>
    </div>
  );
}

export function PostPage() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <article className="space-y-6">
      <ErrorMessage message={error} />
      <Card className="overflow-hidden">
        <CardContent className="space-y-8 p-6 sm:p-8 lg:p-10">
          <div className="space-y-4">
            <p className="section-kicker">Article</p>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                {post?.title ?? "Loading article"}
              </h1>
              {post?.subtitle || post?.excerpt ? (
                <p className="max-w-3xl text-lg leading-8 text-[var(--color-soft-ink)]">
                  {post.excerpt || post.subtitle}
                </p>
              ) : null}
            </div>
            {post ? (
              <div className="flex flex-wrap gap-3 text-sm text-[var(--color-soft-ink)]">
                <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
                <span>{formatDate(post.publishedAt)}</span>
                <span>{post.category?.name ?? "Uncategorized"}</span>
                {post.tags.map((tag) => (
                  <Link key={tag.id} to={`/tag/${tag.slug}`} className="rounded-full bg-[var(--color-paper-muted)] px-3 py-1 hover:text-[var(--color-accent)]">
                    #{tag.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {post?.coverImage ? (
            <div className="overflow-hidden rounded-[32px] border border-black/5">
              <img src={post.coverImage} alt={post.title} className="h-full max-h-[460px] w-full object-cover" />
            </div>
          ) : null}

          {post ? (
            <MarkdownContent content={post.content} />
          ) : (
            <div className="rounded-[28px] bg-[var(--color-paper-muted)] px-5 py-8 text-[var(--color-soft-ink)]">
              The requested post could not be loaded.
            </div>
          )}
        </CardContent>
      </Card>
    </article>
  );
}

function ArchiveHero(props: { kicker: string; title: string; description: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-6 sm:p-8">
        <p className="section-kicker">{props.kicker}</p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{props.title}</h1>
        <p className="max-w-3xl text-base leading-7 text-[var(--color-soft-ink)]">{props.description}</p>
      </CardContent>
    </Card>
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
    <div className="space-y-6">
      <ErrorMessage message={error} />
      <ArchiveHero
        kicker="Category archive"
        title={feed?.category.name ?? "Category archive"}
        description={feed?.category.description ?? "A curated shelf grouped by topic."}
      />
      <ArchiveList posts={feed?.posts ?? []} emptyMessage="No published posts matched this category yet." />
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

  const description = useMemo(
    () => (feed ? `Tagged posts collected under #${feed.tag.name}.` : "A keyword-driven archive."),
    [feed],
  );

  return (
    <div className="space-y-6">
      <ErrorMessage message={error} />
      <ArchiveHero kicker="Tag archive" title={feed ? `#${feed.tag.name}` : "Tag archive"} description={description} />
      <ArchiveList posts={feed?.posts ?? []} emptyMessage="No published posts matched this tag yet." />
    </div>
  );
}

export function StaticInfoPage(props: { title: string; description: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-8">
        <p className="section-kicker">{props.title}</p>
        <h1 className="text-4xl font-semibold tracking-tight">{props.title}</h1>
        <p className="max-w-2xl text-base leading-7 text-[var(--color-soft-ink)]">{props.description}</p>
        <div className="rounded-[24px] bg-[var(--color-paper-muted)] px-5 py-8 text-[var(--color-soft-ink)]">
          This page is intentionally reserved for the next milestone.
        </div>
      </CardContent>
    </Card>
  );
}
