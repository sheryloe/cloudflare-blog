import type { Category, CreatePostInput, MediaAsset, Post, PostStatus, PostSummary, Tag } from "@donggeuri/shared";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

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
import { Button, ErrorMessage, LoadingPanel, ShellCard, formatDate, toDateInputValue, toIsoValue } from "./ui";

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
      <ShellCard title="Workspace status" description="A quick snapshot of the content system.">
        <ErrorMessage message={error} />
        <div className="stats-grid">
          <div className="stat-box"><strong>{posts.length}</strong><span>Total posts</span></div>
          <div className="stat-box"><strong>{posts.filter((post) => post.status === "draft").length}</strong><span>Drafts</span></div>
          <div className="stat-box"><strong>{posts.filter((post) => post.status === "published").length}</strong><span>Published</span></div>
          <div className="stat-box"><strong>{media.length}</strong><span>Media assets</span></div>
          <div className="stat-box"><strong>{categories.length}</strong><span>Categories</span></div>
          <div className="stat-box"><strong>{tags.length}</strong><span>Tags</span></div>
        </div>
      </ShellCard>

      <ShellCard title="Recent posts" description="Latest edited content from D1.">
        {posts.length ? (
          <ul className="post-list">
            {posts.slice(0, 6).map((post) => (
              <li key={post.id}>
                <div>
                  <strong>{post.title}</strong>
                  <p className="meta-line">{post.slug}</p>
                </div>
                <div className="status-stack">
                  <span className={`status-pill status-pill--${post.status}`}>{post.status}</span>
                  <small>{formatDate(post.updatedAt)}</small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">No posts created yet.</div>
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
      description="Create, edit, publish, and remove blog content."
      actions={<Link className="button button--primary" to="/posts/new">New post</Link>}
    >
      <ErrorMessage message={error} />
      {posts.length ? (
        <ul className="admin-list">
          {posts.map((post) => (
            <li key={post.id}>
              <div>
                <strong>{post.title}</strong>
                <p className="meta-line">{post.slug}</p>
              </div>
              <div className="admin-list__actions">
                <span className={`status-pill status-pill--${post.status}`}>{post.status}</span>
                <Link className="text-link" to={`/posts/${post.id}/edit`}>Edit</Link>
                <Button tone="danger" type="button" onClick={() => void handleDelete(post.id)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">No posts yet. Create the first one from this screen.</div>
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
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="field-grid field-grid--two">
          <label className="field"><span>Title</span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required /></label>
          <label className="field"><span>Slug</span><input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="auto-generated if empty" /></label>
        </div>
        <div className="field-grid field-grid--two">
          <label className="field"><span>Subtitle</span><input value={form.subtitle} onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))} /></label>
          <label className="field"><span>YouTube URL</span><input value={form.youtubeUrl} onChange={(event) => setForm((current) => ({ ...current, youtubeUrl: event.target.value }))} /></label>
        </div>
        <label className="field"><span>Excerpt</span><textarea rows={3} value={form.excerpt} onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))} /></label>
        <label className="field"><span>Content</span><textarea rows={12} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} required /></label>
        <div className="field-grid field-grid--three">
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PostStatus }))}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="field"><span>Published at</span><input type="datetime-local" value={form.publishedAt} onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))} /></label>
          <label className="field">
            <span>Category</span>
            <select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
              <option value="">No category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Cover image</span>
          <select value={form.coverImage} onChange={(event) => setForm((current) => ({ ...current, coverImage: event.target.value }))}>
            <option value="">No cover image</option>
            {media.map((asset) => <option key={asset.id} value={asset.url}>{asset.path}</option>)}
          </select>
        </label>
        <div className="field">
          <span>Tags</span>
          <div className="checkbox-grid">
            {tags.map((tag) => (
              <label key={tag.id} className="checkbox-pill">
                <input type="checkbox" checked={form.tagIds.includes(tag.id)} onChange={() => handleTagToggle(tag.id)} />
                <span>{tag.name}</span>
              </label>
            ))}
            {tags.length === 0 ? <div className="empty-state">Create tags first to attach them here.</div> : null}
          </div>
        </div>
        <ErrorMessage message={error} />
        <div className="actions-row">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : isEdit ? "Save changes" : "Create post"}</Button>
          <Link className="text-link" to="/posts">Back to posts</Link>
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
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field"><span>File</span><input id="media-file-input" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></label>
          <div className="field-grid field-grid--two">
            <label className="field"><span>Post slug</span><input value={postSlug} onChange={(event) => setPostSlug(event.target.value)} /></label>
            <label className="field"><span>Alt text</span><input value={altText} onChange={(event) => setAltText(event.target.value)} /></label>
          </div>
          <ErrorMessage message={error} />
          <Button type="submit" disabled={submitting}>{submitting ? "Uploading..." : "Upload asset"}</Button>
        </form>
      </ShellCard>

      <ShellCard title="Media library" description="Available assets that can be reused in posts.">
        {assets.length ? (
          <ul className="media-grid">
            {assets.map((asset) => (
              <li key={asset.id}>
                <strong>{asset.path}</strong>
                <p className="meta-line">{asset.mimeType}</p>
                <p className="meta-line">{asset.altText || "No alt text"}</p>
                <a className="text-link" href={asset.url} target="_blank" rel="noreferrer">Open asset</a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">No media uploaded yet.</div>
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
      setDrafts(Object.fromEntries(categories.map((category) => [category.id, { name: category.name, slug: category.slug, description: category.description ?? "" }])));
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
      <ShellCard title="Create category" description="Manage public post grouping.">
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); void createAdminCategory(createForm).then(refresh).then(() => setCreateForm({ name: "", slug: "", description: "" })).catch((reason: Error) => setError(reason.message)); }}>
          <div className="field-grid field-grid--three">
            <label className="field"><span>Name</span><input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} required /></label>
            <label className="field"><span>Slug</span><input value={createForm.slug} onChange={(event) => setCreateForm((current) => ({ ...current, slug: event.target.value }))} /></label>
            <label className="field"><span>Description</span><input value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} /></label>
          </div>
          <ErrorMessage message={error} />
          <Button type="submit">Create category</Button>
        </form>
      </ShellCard>

      <ShellCard title="Existing categories" description="Inline edit and cleanup.">
        <ul className="editor-list">
          {items.map((item) => (
            <li key={item.id}>
              <div className="field-grid field-grid--three">
                <label className="field"><span>Name</span><input value={drafts[item.id]?.name ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], name: event.target.value } }))} /></label>
                <label className="field"><span>Slug</span><input value={drafts[item.id]?.slug ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], slug: event.target.value } }))} /></label>
                <label className="field"><span>Description</span><input value={drafts[item.id]?.description ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], description: event.target.value } }))} /></label>
              </div>
              <div className="actions-row">
                <Button type="button" onClick={() => void updateAdminCategory(item.id, drafts[item.id]).then(refresh).catch((reason: Error) => setError(reason.message))}>Save</Button>
                <Button tone="danger" type="button" onClick={() => void deleteAdminCategory(item.id).then(refresh).catch((reason: Error) => setError(reason.message))}>Delete</Button>
              </div>
            </li>
          ))}
          {items.length === 0 ? <li className="empty-state">No categories yet.</li> : null}
        </ul>
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
      <ShellCard title="Create tag" description="Manage keyword metadata for posts.">
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); void createAdminTag(createForm).then(refresh).then(() => setCreateForm({ name: "", slug: "" })).catch((reason: Error) => setError(reason.message)); }}>
          <div className="field-grid field-grid--two">
            <label className="field"><span>Name</span><input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} required /></label>
            <label className="field"><span>Slug</span><input value={createForm.slug} onChange={(event) => setCreateForm((current) => ({ ...current, slug: event.target.value }))} /></label>
          </div>
          <ErrorMessage message={error} />
          <Button type="submit">Create tag</Button>
        </form>
      </ShellCard>

      <ShellCard title="Existing tags" description="Inline edit and cleanup.">
        <ul className="editor-list">
          {items.map((item) => (
            <li key={item.id}>
              <div className="field-grid field-grid--two">
                <label className="field"><span>Name</span><input value={drafts[item.id]?.name ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], name: event.target.value } }))} /></label>
                <label className="field"><span>Slug</span><input value={drafts[item.id]?.slug ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], slug: event.target.value } }))} /></label>
              </div>
              <div className="actions-row">
                <Button type="button" onClick={() => void updateAdminTag(item.id, drafts[item.id]).then(refresh).catch((reason: Error) => setError(reason.message))}>Save</Button>
                <Button tone="danger" type="button" onClick={() => void deleteAdminTag(item.id).then(refresh).catch((reason: Error) => setError(reason.message))}>Delete</Button>
              </div>
            </li>
          ))}
          {items.length === 0 ? <li className="empty-state">No tags yet.</li> : null}
        </ul>
      </ShellCard>
    </>
  );
}
