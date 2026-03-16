import type { Category, CategoryFeed, Post, PostSummary, TagFeed } from "@donggeuri/shared";
import { useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";

import { getCategoryFeed, getPost, getTagFeed, listCategories, listPosts } from "./lib/api";
import { ErrorMessage, ShellCard, formatDate } from "./ui";

function PostList(props: { posts: PostSummary[]; emptyMessage: string }) {
  if (!props.posts.length) {
    return <div className="empty-state">{props.emptyMessage}</div>;
  }

  return (
    <ul className="post-list">
      {props.posts.map((post) => (
        <li key={post.id}>
          <div>
            <Link to={`/post/${post.slug}`}>{post.title}</Link>
            <p className="meta-line">{post.excerpt || post.subtitle || "No summary yet."}</p>
          </div>
          <div className="status-stack">
            <span className={`status-pill status-pill--${post.status}`}>{post.status}</span>
            <small>{formatDate(post.publishedAt ?? post.updatedAt)}</small>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PublicLayout() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    void listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  return (
    <div className="page-shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">Pages + Workers + D1 + R2</p>
          <h1>Donggeuri Blog Platform</h1>
        </div>
        <nav className="nav-row">
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/search">Search</Link>
          <Link to="/login">Admin</Link>
        </nav>
      </header>

      <main className="content-grid">
        <Outlet />

        <aside className="sidebar">
          <ShellCard title="Categories" description="Public category navigation from D1.">
            <ul className="token-list">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link to={`/category/${category.slug}`}>{category.name}</Link>
                </li>
              ))}
              {categories.length === 0 ? <li>No categories yet.</li> : null}
            </ul>
          </ShellCard>
        </aside>
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

  return (
    <div className="main-column">
      <ShellCard title="Published posts" description="Only published content is shown on the public site.">
        <ErrorMessage message={error} />
        <PostList posts={posts} emptyMessage="No published posts yet." />
      </ShellCard>
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
    <div className="main-column">
      <ShellCard title={post?.title ?? "Post detail"} description={post?.excerpt ?? `Slug: ${slug}`}>
        <ErrorMessage message={error} />
        {post ? (
          <>
            <div className="detail-grid">
              <div>
                <strong>Status</strong>
                <p>{post.status}</p>
              </div>
              <div>
                <strong>Published</strong>
                <p>{formatDate(post.publishedAt)}</p>
              </div>
              <div>
                <strong>Category</strong>
                <p>{post.category?.name ?? "Uncategorized"}</p>
              </div>
              <div>
                <strong>Tags</strong>
                <p>{post.tags.map((tag) => tag.name).join(", ") || "None"}</p>
              </div>
            </div>
            <pre className="content-block">{post.content}</pre>
          </>
        ) : (
          <div className="empty-state">The requested post could not be loaded.</div>
        )}
      </ShellCard>
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
    <div className="main-column">
      <ShellCard
        title={feed?.category.name ?? "Category archive"}
        description={feed?.category.description ?? `Slug: ${slug}`}
      >
        <ErrorMessage message={error} />
        <PostList posts={feed?.posts ?? []} emptyMessage="No published posts matched this category yet." />
      </ShellCard>
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
    <div className="main-column">
      <ShellCard title={feed ? `Tag: ${feed.tag.name}` : "Tag archive"} description={`Slug: ${slug}`}>
        <ErrorMessage message={error} />
        <PostList posts={feed?.posts ?? []} emptyMessage="No published posts matched this tag yet." />
      </ShellCard>
    </div>
  );
}

export function StaticInfoPage(props: { title: string; description: string }) {
  return (
    <div className="main-column">
      <ShellCard title={props.title} description={props.description}>
        <div className="empty-state">This route is intentionally left for the next milestone.</div>
      </ShellCard>
    </div>
  );
}
