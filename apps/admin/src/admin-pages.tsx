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
      <p className="section-kicker">현황</p>
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
      <ShellCard title="작업 현황" description="현재 관리자 화면의 핵심 상태를 빠르게 확인합니다.">
        <ErrorMessage message={error} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="전체 글" value={posts.length} />
          <StatCard label="초안" value={posts.filter((post) => post.status === "draft").length} />
          <StatCard label="공개 글" value={posts.filter((post) => post.status === "published").length} />
          <StatCard label="미디어" value={media.length} />
          <StatCard label="카테고리" value={categories.length} />
          <StatCard label="태그" value={tags.length} />
        </div>
      </ShellCard>

      <ShellCard title="최근 변경" description="최근 수정된 글을 확인합니다.">
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
            아직 작성된 글이 없습니다.
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
      setError(reason instanceof Error ? reason.message : "글 목록을 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 글을 삭제할까요?")) {
      return;
    }

    try {
      await deleteAdminPost(id);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "삭제에 실패했습니다.");
    }
  };

  return (
    <ShellCard
      title="글 목록"
      description="작성한 글을 수정하고, 공개 상태를 관리합니다."
      actions={
        <Button asChild>
          <Link to="/posts/new">
            <Plus className="h-4 w-4" />
            새 글
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
                      수정
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={`${PUBLIC_APP_URL}/post/${post.slug}`} target="_blank" rel="noreferrer">
                      미리보기
                    </a>
                  </Button>
                  <Button variant="ghost" onClick={() => void handleDelete(post.id)}>
                    <Trash2 className="h-4 w-4" />
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
          <div className="rounded-[24px] bg-[var(--color-paper-muted)] px-5 py-8 text-[var(--color-soft-ink)]">
            아직 글이 없습니다. 이 화면에서 첫 글을 작성할 수 있습니다.
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
      setError(reason instanceof Error ? reason.message : "글 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingPanel message="편집 화면을 준비하는 중입니다." />;
  }

  return (
    <ShellCard
      title={isEdit ? "글 수정" : "새 글 작성"}
      description="티스토리처럼 본문을 먼저 쓰고, 발행 설정은 오른쪽에서 정리하는 구조로 단순화했습니다."
    >
      <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]" onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <span className="field-label">제목</span>
              <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
            </label>
            <label className="block">
              <span className="field-label">슬러그</span>
              <Input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="비워두면 자동 생성" />
            </label>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <span className="field-label">부제</span>
              <Input value={form.subtitle} onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))} />
            </label>
            <label className="block">
              <span className="field-label">유튜브 URL</span>
              <Input value={form.youtubeUrl} onChange={(event) => setForm((current) => ({ ...current, youtubeUrl: event.target.value }))} />
            </label>
          </div>

          <label className="block">
            <span className="field-label">요약</span>
            <Textarea rows={4} value={form.excerpt} onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))} />
          </label>

          <label className="block">
            <span className="field-label">본문</span>
            <Textarea
              rows={20}
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              required
              className="min-h-[420px]"
            />
          </label>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-black/6 bg-white/70 p-5 shadow-sm">
            <p className="section-kicker">발행 설정</p>
            <div className="mt-4 grid gap-4">
              <label className="block">
                <span className="field-label">상태</span>
                <Select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PostStatus }))}>
                  <option value="draft">초안</option>
                  <option value="published">공개</option>
                  <option value="archived">보관</option>
                </Select>
              </label>
              <label className="block">
                <span className="field-label">발행일</span>
                <Input type="datetime-local" value={form.publishedAt} onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))} />
              </label>
              <label className="block">
                <span className="field-label">카테고리</span>
                <Select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
                  <option value="">카테고리 없음</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </div>

          <div className="rounded-[24px] border border-black/6 bg-white/70 p-5 shadow-sm">
            <p className="section-kicker">대표 이미지</p>
            <div className="mt-4">
              <label className="block">
                <span className="field-label">커버 이미지</span>
                <Select value={form.coverImage} onChange={(event) => setForm((current) => ({ ...current, coverImage: event.target.value }))}>
                  <option value="">대표 이미지 없음</option>
                  {media.map((asset) => (
                    <option key={asset.id} value={asset.url}>
                      {asset.path}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </div>

          <div className="rounded-[24px] border border-black/6 bg-white/70 p-5 shadow-sm">
            <p className="section-kicker">태그</p>
            <div className="mt-4 grid gap-3">
              {tags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-3 rounded-[18px] border border-black/5 bg-white/80 px-4 py-3">
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
                <div className="rounded-[18px] bg-[var(--color-paper-muted)] px-4 py-4 text-sm text-[var(--color-soft-ink)]">
                  먼저 태그를 만든 뒤 이곳에서 연결할 수 있습니다.
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="xl:col-span-2 space-y-4">
          <ErrorMessage message={error} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "저장 중..." : isEdit ? "변경 사항 저장" : "글 만들기"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/posts">글 목록으로</Link>
            </Button>
          </div>
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
