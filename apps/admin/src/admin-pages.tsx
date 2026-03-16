import type {
  Category,
  CreatePostInput,
  MediaAsset,
  Post,
  PostStatus,
  PostSummary,
  Tag,
} from "@donggeuri/shared";
import { ImagePlus, PenSquare, Plus, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import {
  createAdminCategory,
  createAdminPost,
  createAdminTag,
  deleteAdminCategory,
  deleteAdminPost,
  deleteAdminTag,
  getAdminPost,
  listAdminCategories,
  listAdminPosts,
  listAdminTags,
  listMediaAssets,
  updateAdminCategory,
  updateAdminPost,
  updateAdminTag,
  uploadMediaAsset,
} from "./lib/api";
import { ErrorMessage, LoadingPanel, ShellCard, formatDate, toDateInputValue, toIsoValue } from "./ui";

const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:5173";

type PostFormState = {
  title: string;
  subtitle: string;
  slug: string;
  excerpt: string;
  content: string;
  categoryId: string;
  tagIds: string[];
  coverImage: string;
  youtubeUrl: string;
  status: PostStatus;
  publishedAt: string;
};

const EMPTY_POST_FORM: PostFormState = {
  title: "",
  subtitle: "",
  slug: "",
  excerpt: "",
  content: "",
  categoryId: "",
  tagIds: [],
  coverImage: "",
  youtubeUrl: "",
  status: "draft",
  publishedAt: "",
};

function statusVariant(status: PostStatus) {
  if (status === "published") {
    return "published";
  }
  if (status === "draft") {
    return "draft";
  }
  return "archived";
}

function mapPostToForm(post: Post): PostFormState {
  return {
    title: post.title,
    subtitle: post.subtitle ?? "",
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    content: post.content,
    categoryId: post.category?.id ?? "",
    tagIds: post.tags.map((tag) => tag.id),
    coverImage: post.coverImage ?? "",
    youtubeUrl: post.youtubeUrl ?? "",
    status: post.status,
    publishedAt: toDateInputValue(post.publishedAt),
  };
}

function buildPostInput(form: PostFormState): CreatePostInput {
  return {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    slug: form.slug.trim() || undefined,
    excerpt: form.excerpt.trim() || null,
    content: form.content,
    categoryId: form.categoryId || null,
    tagIds: form.tagIds,
    coverImage: form.coverImage || null,
    youtubeUrl: form.youtubeUrl.trim() || null,
    status: form.status,
    publishedAt: toIsoValue(form.publishedAt),
  };
}

function StatCard(props: { label: string; value: number }) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(244,247,251,0.8))] p-5 shadow-[0_18px_60px_rgba(19,32,51,0.08)]">
      <p className="section-kicker">Overview</p>
      <div className="mt-4 text-4xl font-semibold tracking-tight text-[var(--color-ink)]">{props.value}</div>
      <p className="mt-2 text-sm text-[var(--color-soft-ink)]">{props.label}</p>
    </div>
  );
}

export function DashboardPage() {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([listAdminPosts(), listMediaAssets(), listAdminCategories(), listAdminTags()])
      .then(([postItems, mediaItems, categoryItems, tagItems]) => {
        setPosts(postItems);
        setMedia(mediaItems);
        setCategories(categoryItems);
        setTags(tagItems);
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <>
      <ShellCard title="Workspace status" description="A quick editorial snapshot of the current system.">
        <ErrorMessage message={error} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Total posts" value={posts.length} />
          <StatCard label="Drafts" value={posts.filter((post) => post.status === "draft").length} />
          <StatCard label="Published" value={posts.filter((post) => post.status === "published").length} />
          <StatCard label="Media assets" value={media.length} />
          <StatCard label="Categories" value={categories.length} />
          <StatCard label="Tags" value={tags.length} />
        </div>
      </ShellCard>

      <ShellCard title="Recent updates" description="The latest content changes in D1.">
        {posts.length ? (
          <div className="grid gap-4">
            {posts.slice(0, 6).map((post) => (
              <div key={post.id} className="rounded-[24px] border border-white/70 bg-white/72 p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
                    </div>
                    <h3 className="text-xl font-semibold tracking-tight">{post.title}</h3>
                    <p className="text-sm text-[var(--color-soft-ink)]">{post.slug}</p>
                  </div>
                  <p className="text-sm text-[var(--color-soft-ink)]">{formatDate(post.updatedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] bg-[var(--color-paper-muted)] px-5 py-8 text-[var(--color-soft-ink)]">
            No posts created yet.
          </div>
        )}
      </ShellCard>
    </>
  );
}

export function PostsPage() {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setPosts(await listAdminPosts());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load posts.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this post?")) {
      return;
    }

    try {
      await deleteAdminPost(id);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Delete failed.");
    }
  };

  return (
    <ShellCard
      title="Posts"
      description="Create, edit, publish, and archive content."
      actions={
        <Button asChild>
          <Link to="/posts/new">
            <Plus className="h-4 w-4" />
            New post
          </Link>
        </Button>
      }
    >
      <ErrorMessage message={error} />
      {posts.length ? (
        <div className="grid gap-4">
          {posts.map((post) => (
            <div key={post.id} className="rounded-[24px] border border-white/70 bg-white/74 p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
                    <span className="text-sm text-[var(--color-soft-ink)]">{formatDate(post.publishedAt ?? post.updatedAt)}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight">{post.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-soft-ink)]">
                      {post.excerpt || post.subtitle || post.slug}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild variant="soft">
                    <Link to={`/posts/${post.id}/edit`}>
                      <PenSquare className="h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={`${PUBLIC_APP_URL}/post/${post.slug}`} target="_blank" rel="noreferrer">
                      Preview
                    </a>
                  </Button>
                  <Button variant="ghost" onClick={() => void handleDelete(post.id)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
          <div className="rounded-[24px] bg-[var(--color-paper-muted)] px-5 py-8 text-[var(--color-soft-ink)]">
            No posts yet. Create the first one from this screen.
          </div>
      )}
    </ShellCard>
  );
}

export function PostEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<PostFormState>(EMPTY_POST_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      listAdminCategories(),
      listAdminTags(),
      listMediaAssets(),
      isEdit && id ? getAdminPost(id) : Promise.resolve(null),
    ])
      .then(([categoryItems, tagItems, mediaItems, post]) => {
        setCategories(categoryItems);
        setTags(tagItems);
        setMedia(mediaItems);
        setForm(post ? mapPostToForm(post) : EMPTY_POST_FORM);
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const handleTagToggle = (tagId: string) => {
    setForm((current) => ({
      ...current,
      tagIds: current.tagIds.includes(tagId)
        ? current.tagIds.filter((item) => item !== tagId)
        : [...current.tagIds, tagId],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = buildPostInput(form);

      if (isEdit && id) {
        await updateAdminPost(id, payload);
      } else {
        await createAdminPost(payload);
      }

      navigate("/posts", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to save post.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingPanel message="Preparing the post editor." />;
  }

  return (
    <ShellCard title={isEdit ? "Edit post" : "Create post"} description="Write content and manage publishing metadata.">
      <form className="grid gap-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 xl:grid-cols-2">
          <label className="block">
            <span className="field-label">Title</span>
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
          </label>
          <label className="block">
            <span className="field-label">Slug</span>
            <Input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="auto-generated if empty" />
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <label className="block">
            <span className="field-label">Subtitle</span>
            <Input value={form.subtitle} onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))} />
          </label>
          <label className="block">
            <span className="field-label">YouTube URL</span>
            <Input value={form.youtubeUrl} onChange={(event) => setForm((current) => ({ ...current, youtubeUrl: event.target.value }))} />
          </label>
        </div>

        <label className="block">
          <span className="field-label">Excerpt</span>
          <Textarea rows={4} value={form.excerpt} onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))} />
        </label>

        <label className="block">
          <span className="field-label">Content</span>
          <Textarea rows={16} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} required className="min-h-[360px]" />
        </label>

        <div className="grid gap-4 xl:grid-cols-3">
          <label className="block">
            <span className="field-label">Status</span>
            <Select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PostStatus }))}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </label>
          <label className="block">
            <span className="field-label">Published at</span>
            <Input type="datetime-local" value={form.publishedAt} onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))} />
          </label>
          <label className="block">
            <span className="field-label">Category</span>
            <Select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <label className="block">
          <span className="field-label">Cover image</span>
          <Select value={form.coverImage} onChange={(event) => setForm((current) => ({ ...current, coverImage: event.target.value }))}>
            <option value="">No cover image</option>
            {media.map((asset) => (
              <option key={asset.id} value={asset.url}>
                {asset.path}
              </option>
            ))}
          </Select>
        </label>

        <div className="space-y-3">
          <span className="field-label">Tags</span>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-3 rounded-[22px] border border-black/5 bg-white/60 px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={form.tagIds.includes(tag.id)}
                  onChange={() => handleTagToggle(tag.id)}
                  className="h-4 w-4 rounded border-black/20 text-[var(--color-accent)]"
                />
                <span className="text-sm font-medium">{tag.name}</span>
              </label>
            ))}
            {tags.length === 0 ? (
              <div className="rounded-[22px] bg-[var(--color-paper-muted)] px-4 py-4 text-sm text-[var(--color-soft-ink)]">
                Create tags first to attach them here.
              </div>
            ) : null}
          </div>
        </div>

        <ErrorMessage message={error} />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create post"}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/posts">Back to posts</Link>
          </Button>
        </div>
      </form>
    </ShellCard>
  );
}

export function MediaPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [postSlug, setPostSlug] = useState("");
  const [altText, setAltText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    try {
      setAssets(await listMediaAssets());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load media.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setError("Select a file before uploading.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await uploadMediaAsset({ file, postSlug, altText });
      setFile(null);
      setPostSlug("");
      setAltText("");
      const input = document.getElementById("media-file-input") as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ShellCard title="Upload media" description="Files are stored in R2 and indexed in D1.">
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="field-label">File</span>
            <Input id="media-file-input" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
          </label>
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <span className="field-label">Post slug</span>
              <Input value={postSlug} onChange={(event) => setPostSlug(event.target.value)} />
            </label>
            <label className="block">
              <span className="field-label">Alt text</span>
              <Input value={altText} onChange={(event) => setAltText(event.target.value)} />
            </label>
          </div>
          <ErrorMessage message={error} />
          <Button type="submit" disabled={submitting}>
            <ImagePlus className="h-4 w-4" />
            {submitting ? "Uploading..." : "Upload asset"}
          </Button>
        </form>
      </ShellCard>

      <ShellCard title="Media library" description="Assets ready for reuse in articles and covers.">
        {assets.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <div key={asset.id} className="rounded-[24px] border border-white/70 bg-white/74 p-5 shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant="default">{asset.mimeType}</Badge>
                    <span className="text-xs text-[var(--color-soft-ink)]">{Math.round(asset.size / 1024)} KB</span>
                  </div>
                  <p className="break-all text-sm font-medium text-[var(--color-ink)]">{asset.path}</p>
                  <p className="text-sm leading-6 text-[var(--color-soft-ink)]">{asset.altText || "No alt text"}</p>
                  <a className="text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-ink)]" href={asset.url} target="_blank" rel="noreferrer">
                    Open asset
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] bg-[var(--color-paper-muted)] px-5 py-8 text-[var(--color-soft-ink)]">
            No media uploaded yet.
          </div>
        )}
      </ShellCard>
    </>
  );
}

export function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { name: string; slug: string; description: string }>>({});
  const [createForm, setCreateForm] = useState({ name: "", slug: "", description: "" });
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const categories = await listAdminCategories();
      setItems(categories);
      setDrafts(
        Object.fromEntries(
          categories.map((category) => [
            category.id,
            { name: category.name, slug: category.slug, description: category.description ?? "" },
          ]),
        ),
      );
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load categories.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <>
      <ShellCard title="Create category" description="Manage topic shelves for the public archive.">
        <form
          className="grid gap-4 xl:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            void createAdminCategory(createForm)
              .then(refresh)
              .then(() => setCreateForm({ name: "", slug: "", description: "" }))
              .catch((reason: Error) => setError(reason.message));
          }}
        >
          <label className="block">
            <span className="field-label">Name</span>
            <Input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} required />
          </label>
          <label className="block">
            <span className="field-label">Slug</span>
            <Input value={createForm.slug} onChange={(event) => setCreateForm((current) => ({ ...current, slug: event.target.value }))} />
          </label>
          <label className="block">
            <span className="field-label">Description</span>
            <Input value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <div className="xl:col-span-3">
            <ErrorMessage message={error} />
          </div>
          <div className="xl:col-span-3">
            <Button type="submit">Create category</Button>
          </div>
        </form>
      </ShellCard>

      <ShellCard title="Existing categories" description="Inline edit and cleanup.">
        <div className="grid gap-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-white/70 bg-white/74 p-5 shadow-sm">
              <div className="grid gap-4 xl:grid-cols-3">
                <label className="block">
                  <span className="field-label">Name</span>
                  <Input value={drafts[item.id]?.name ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], name: event.target.value } }))} />
                </label>
                <label className="block">
                  <span className="field-label">Slug</span>
                  <Input value={drafts[item.id]?.slug ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], slug: event.target.value } }))} />
                </label>
                <label className="block">
                  <span className="field-label">Description</span>
                  <Input value={drafts[item.id]?.description ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], description: event.target.value } }))} />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" variant="soft" onClick={() => void updateAdminCategory(item.id, drafts[item.id]).then(refresh).catch((reason: Error) => setError(reason.message))}>
                  Save
                </Button>
                <Button type="button" variant="ghost" onClick={() => void deleteAdminCategory(item.id).then(refresh).catch((reason: Error) => setError(reason.message))}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {items.length === 0 ? (
            <div className="rounded-[24px] bg-[var(--color-paper-muted)] px-5 py-8 text-[var(--color-soft-ink)]">
              No categories yet.
            </div>
          ) : null}
        </div>
      </ShellCard>
    </>
  );
}

export function TagsPage() {
  const [items, setItems] = useState<Tag[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { name: string; slug: string }>>({});
  const [createForm, setCreateForm] = useState({ name: "", slug: "" });
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const tags = await listAdminTags();
      setItems(tags);
      setDrafts(Object.fromEntries(tags.map((tag) => [tag.id, { name: tag.name, slug: tag.slug }])));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load tags.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <>
      <ShellCard title="Create tag" description="Manage lightweight keywords for discovery.">
        <form
          className="grid gap-4 xl:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void createAdminTag(createForm)
              .then(refresh)
              .then(() => setCreateForm({ name: "", slug: "" }))
              .catch((reason: Error) => setError(reason.message));
          }}
        >
          <label className="block">
            <span className="field-label">Name</span>
            <Input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} required />
          </label>
          <label className="block">
            <span className="field-label">Slug</span>
            <Input value={createForm.slug} onChange={(event) => setCreateForm((current) => ({ ...current, slug: event.target.value }))} />
          </label>
          <div className="xl:col-span-2">
            <ErrorMessage message={error} />
          </div>
          <div className="xl:col-span-2">
            <Button type="submit">Create tag</Button>
          </div>
        </form>
      </ShellCard>

      <ShellCard title="Existing tags" description="Inline edit and cleanup.">
        <div className="grid gap-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-white/70 bg-white/74 p-5 shadow-sm">
              <div className="grid gap-4 xl:grid-cols-2">
                <label className="block">
                  <span className="field-label">Name</span>
                  <Input value={drafts[item.id]?.name ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], name: event.target.value } }))} />
                </label>
                <label className="block">
                  <span className="field-label">Slug</span>
                  <Input value={drafts[item.id]?.slug ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], slug: event.target.value } }))} />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" variant="soft" onClick={() => void updateAdminTag(item.id, drafts[item.id]).then(refresh).catch((reason: Error) => setError(reason.message))}>
                  Save
                </Button>
                <Button type="button" variant="ghost" onClick={() => void deleteAdminTag(item.id).then(refresh).catch((reason: Error) => setError(reason.message))}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {items.length === 0 ? (
            <div className="rounded-[24px] bg-[var(--color-paper-muted)] px-5 py-8 text-[var(--color-soft-ink)]">
              No tags yet.
            </div>
          ) : null}
        </div>
      </ShellCard>
    </>
  );
}
