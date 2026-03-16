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
  { href: "/", label: "Home", external: false },
  { href: "/about", label: "About", external: false },
  { href: "/search", label: "Search", external: false },
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

function MetaPill(props: { label: string; value: string }) {
  return (
    <div className="story-chip">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function SectionIntro(props: { kicker: string; title: string; description: string }) {
  return (
    <div className="section-heading">
      <p className="section-kicker">{props.kicker}</p>
      <h2>{props.title}</h2>
      <p className="max-w-3xl text-sm leading-7 text-[var(--color-soft-ink)] sm:text-base">{props.description}</p>
    </div>
  );
}

function PostMeta(props: { post: Pick<PostSummary, "status" | "publishedAt" | "updatedAt">; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 text-sm text-[var(--color-soft-ink)]",
        props.compact && "gap-2 text-xs",
      )}
    >
      <Badge variant={statusVariant(props.post.status)}>{props.post.status}</Badge>
      <span>{formatDate(props.post.publishedAt ?? props.post.updatedAt)}</span>
    </div>
  );
}

function NavigationLink(props: { href: string; label: string; external?: boolean }) {
  if (props.external) {
    return (
      <a
        href={props.href}
        className="rounded-full px-4 py-2 text-sm font-medium text-[var(--color-soft-ink)] hover:bg-black/5 hover:text-[var(--color-ink)]"
      >
        {props.label}
      </a>
    );
  }

  return (
    <Link
      to={props.href}
      className="rounded-full px-4 py-2 text-sm font-medium text-[var(--color-soft-ink)] hover:bg-black/5 hover:text-[var(--color-ink)]"
    >
      {props.label}
    </Link>
  );
}

function PublicNav() {
  return (
    <>
      <nav className="hidden items-center gap-2 rounded-full border border-white/70 bg-white/72 p-2 shadow-[0_16px_48px_rgba(24,32,43,0.08)] md:flex">
        {publicLinks.map((item) => (
          <NavigationLink key={item.href} href={item.href} label={item.label} external={item.external} />
        ))}
      </nav>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="border-white/80 bg-white/80 shadow-sm md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent className="border-black/5 bg-[rgba(252,248,241,0.97)]">
          <SheetHeader>
            <SheetTitle>Donggeuri Blog</SheetTitle>
            <SheetDescription>Navigate the public site and jump into the admin workspace.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 grid gap-3">
            {publicLinks.map((item) =>
              item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-[22px] border border-black/6 bg-white px-4 py-3 text-sm font-medium text-[var(--color-ink)] shadow-sm"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  to={item.href}
                  className="rounded-[22px] border border-black/6 bg-white px-4 py-3 text-sm font-medium text-[var(--color-ink)] shadow-sm"
                >
                  {item.label}
                </Link>
              ),
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function EditorialPostCard(props: { post: PostSummary; featured?: boolean }) {
  return (
    <Card
      className={cn(
        "surface-outline overflow-hidden",
        props.featured
          ? "grid gap-0 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
          : "h-full transition duration-300 hover:-translate-y-1 hover:shadow-[0_32px_110px_rgba(24,32,43,0.12)]",
      )}
    >
      {props.post.coverImage ? (
        <div className={cn("relative overflow-hidden", props.featured ? "min-h-[340px] xl:min-h-full" : "aspect-[16/11]")}>
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
          <img
            src={props.post.coverImage}
            alt={props.post.title}
            className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
          />
        </div>
      ) : null}
      <CardContent
        className={cn(
          "flex flex-col gap-5 p-6 sm:p-7",
          props.featured && "justify-center p-8 sm:p-10 lg:p-12",
        )}
      >
        <div className="flex flex-wrap gap-2">
          <span className="story-chip">
            <span className="section-kicker !tracking-[0.26em]">
              {props.featured ? "Lead story" : "Notebook entry"}
            </span>
          </span>
          <MetaPill
            label="Published"
            value={new Date(props.post.publishedAt ?? props.post.updatedAt).toLocaleDateString()}
          />
        </div>
        <div className="space-y-3">
          <Link
            to={`/post/${props.post.slug}`}
            className={cn(
              "block text-balance font-semibold tracking-tight text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)]",
              props.featured ? "text-4xl leading-tight sm:text-5xl xl:text-6xl" : "text-[1.8rem] leading-tight",
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
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant={props.featured ? "default" : "soft"} className="rounded-full px-5">
            <Link to={`/post/${props.post.slug}`}>
              Read article
              <MoveRight className="h-4 w-4" />
            </Link>
          </Button>
          <span className="text-sm text-[var(--color-soft-ink)]">Built for long-form reading across desktop and mobile.</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ArchiveList(props: { posts: PostSummary[]; emptyMessage: string }) {
  if (!props.posts.length) {
    return (
      <div className="surface-outline px-5 py-10 text-center text-[var(--color-soft-ink)]">{props.emptyMessage}</div>
    );
  }

  return (
    <div className="grid gap-4">
      {props.posts.map((post, index) => (
        <Card
          key={post.id}
          className="surface-outline overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_100px_rgba(24,32,43,0.11)]"
        >
          <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <div className="hidden lg:flex">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,rgba(190,93,55,0.12),rgba(63,111,139,0.12))] text-lg font-semibold text-[var(--color-accent)]">
                {(index + 1).toString().padStart(2, "0")}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
                <span className="story-chip py-1 text-[11px]">{post.slug}</span>
              </div>
              <Link
                to={`/post/${post.slug}`}
                className="text-2xl font-semibold tracking-tight text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)]"
              >
                {post.title}
              </Link>
              {post.excerpt || post.subtitle ? (
                <p className="max-w-3xl text-sm leading-7 text-[var(--color-soft-ink)]">
                  {post.excerpt || post.subtitle}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <PostMeta post={post} compact />
              <Button asChild variant="ghost" size="sm" className="rounded-full">
                <Link to={`/post/${post.slug}`}>Open story</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Sidebar(props: { categories: Category[] }) {
  return (
    <aside className="space-y-6 xl:sticky xl:top-6">
      <Card className="surface-outline overflow-hidden">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <p className="section-kicker">Reading room</p>
            <h3 className="text-2xl font-semibold tracking-tight">Category shelves</h3>
            <p className="text-sm leading-7 text-[var(--color-soft-ink)]">
              Move through the archive like a quiet magazine rack instead of a utility sidebar.
            </p>
          </div>
          <div className="grid gap-3">
            {props.categories.slice(0, 6).map((category) => (
              <Link
                key={category.id}
                to={`/category/${category.slug}`}
                className="rounded-[22px] border border-black/6 bg-white/70 px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:-translate-y-0.5 hover:bg-white"
              >
                {category.name}
              </Link>
            ))}
            {props.categories.length === 0 ? (
              <p className="rounded-[22px] bg-[var(--color-paper-muted)] px-4 py-4 text-sm text-[var(--color-soft-ink)]">
                Categories will appear here once published posts are organized.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="surface-outline overflow-hidden">
        <CardContent className="space-y-5 p-6">
          <p className="section-kicker">Stack</p>
          <div className="flex flex-wrap gap-2">
            <MetaPill label="Pages" value="Web" />
            <MetaPill label="Workers" value="API" />
            <MetaPill label="Storage" value="D1 + R2" />
          </div>
          <p className="text-sm leading-7 text-[var(--color-soft-ink)]">
            A Cloudflare-only setup shaped into a publishing surface rather than a default dashboard skin.
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
      <header className="mb-8 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="story-chip border-white/80 bg-white/78 shadow-sm">
            <span className="section-kicker !tracking-[0.28em]">Donggeuri Editorial</span>
          </div>
          <PublicNav />
        </div>

        <div className="surface-outline overflow-hidden px-5 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:items-end">
            <div className="space-y-5">
              <p className="section-kicker">Cloudflare-only publishing system</p>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-5xl xl:text-[4.5rem] xl:leading-none">
                  Stories, notes, and experiments arranged like a small digital magazine.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-[var(--color-soft-ink)] sm:text-lg">
                  Donggeuri combines Pages, Workers, D1, and R2 into a blog that feels deliberate on mobile and spacious on desktop.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <MetaPill label="Categories" value={String(categories.length)} />
                <MetaPill label="Theme" value="Editorial" />
                <MetaPill label="Mobile" value="Optimized" />
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[30px] border border-black/6 bg-[linear-gradient(135deg,rgba(24,32,43,0.96),rgba(40,67,92,0.92))] p-6 text-white shadow-[0_24px_90px_rgba(24,32,43,0.28)]">
                <p className="section-kicker !text-[rgba(255,234,214,0.82)]">Design direction</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Reading first, chrome second.</h2>
                <p className="mt-3 text-sm leading-7 text-[rgba(244,240,234,0.76)]">
                  The public surface leans into typography, layered cards, and quiet motion instead of flat boilerplate layouts.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div className="rounded-[24px] border border-black/6 bg-white/72 p-4 shadow-sm">
                  <p className="section-kicker">Surface</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">Responsive cards</p>
                </div>
                <div className="rounded-[24px] border border-black/6 bg-white/72 p-4 shadow-sm">
                  <p className="section-kicker">Content</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">Markdown article flow</p>
                </div>
                <div className="rounded-[24px] border border-black/6 bg-white/72 p-4 shadow-sm">
                  <p className="section-kicker">Admin</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">Separate ops app</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="editorial-grid">
        <div className="space-y-8">
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
    <div className="space-y-8">
      <ErrorMessage message={error} />

      {posts.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="surface-outline p-4">
            <p className="section-kicker">Live posts</p>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{posts.length}</div>
          </div>
          <div className="surface-outline p-4">
            <p className="section-kicker">Lead stories</p>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{Math.min(leadStories.length + Number(Boolean(featured)), 3)}</div>
          </div>
          <div className="surface-outline p-4">
            <p className="section-kicker">Archive shelf</p>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{archiveStories.length}</div>
          </div>
        </div>
      ) : null}

      {featured ? (
        <section className="space-y-4">
          <SectionIntro
            kicker="Featured"
            title="A lead story that anchors the issue"
            description="The first published article takes the large-format position to make the homepage feel curated rather than auto-generated."
          />
          <EditorialPostCard post={featured} featured />
        </section>
      ) : (
        <Card className="surface-outline overflow-hidden">
          <CardContent className="p-8 text-center text-[var(--color-soft-ink)]">
            Your first published post will become the lead story here.
          </CardContent>
        </Card>
      )}

      {leadStories.length ? (
        <section className="space-y-4">
          <SectionIntro
            kicker="Highlights"
            title="Secondary stories with equal visual weight"
            description="These cards keep the front page feeling alive without collapsing into a generic list."
          />
          <div className="grid gap-6 xl:grid-cols-2">
            {leadStories.map((post) => (
              <EditorialPostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionIntro
          kicker="Archive"
          title="Latest published entries"
          description="Everything beyond the current feature set stays easy to scan on desktop and comfortable on small screens."
        />
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
      <Card className="surface-outline overflow-hidden">
        <CardContent className="space-y-8 p-6 sm:p-8 lg:p-10 xl:p-12">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="story-chip">
                <span className="section-kicker !tracking-[0.26em]">Article</span>
              </span>
              <Button asChild variant="ghost" size="sm" className="rounded-full">
                <Link to="/">Back to home</Link>
              </Button>
            </div>

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
              <div className="flex flex-wrap gap-2">
                <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
                <MetaPill label="Published" value={new Date(post.publishedAt ?? post.updatedAt).toLocaleDateString()} />
                <MetaPill label="Category" value={post.category?.name ?? "Uncategorized"} />
                {post.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    to={`/tag/${tag.slug}`}
                    className="story-chip hover:text-[var(--color-accent)]"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {post?.coverImage ? (
            <div className="overflow-hidden rounded-[32px] border border-black/5 shadow-[0_24px_80px_rgba(24,32,43,0.12)]">
              <img src={post.coverImage} alt={post.title} className="h-full max-h-[520px] w-full object-cover" />
            </div>
          ) : null}

          {post ? (
            <MarkdownContent content={post.content} />
          ) : (
            <div className="rounded-[28px] border border-black/5 bg-white/65 px-5 py-8 text-[var(--color-soft-ink)]">
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
    <Card className="surface-outline overflow-hidden">
      <CardContent className="space-y-4 p-6 sm:p-8">
        <span className="story-chip">
          <span className="section-kicker !tracking-[0.26em]">{props.kicker}</span>
        </span>
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
    <Card className="surface-outline overflow-hidden">
      <CardContent className="space-y-5 p-8">
        <span className="story-chip">
          <span className="section-kicker !tracking-[0.26em]">{props.title}</span>
        </span>
        <h1 className="text-4xl font-semibold tracking-tight">{props.title}</h1>
        <p className="max-w-2xl text-base leading-7 text-[var(--color-soft-ink)]">{props.description}</p>
        <div className="rounded-[24px] border border-black/5 bg-white/65 px-5 py-8 text-[var(--color-soft-ink)]">
          This page is intentionally reserved for the next milestone.
        </div>
      </CardContent>
    </Card>
  );
}
