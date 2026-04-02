import type { Category, MediaAsset, PostStatus, PostSummary, Tag } from "@cloudflare-blog/shared";
import { ImagePlus, PenSquare, Plus, Trash2 } from "lucide-react";
import {
  DEFAULT_SITE_SETTINGS,
  type TagQualityIssue,
  computeTagIndexCandidate,
  computeTagQualityIssues,
} from "@cloudflare-blog/shared";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import {
  createAdminCategory,
  createAdminTag,
  deleteAdminCategory,
  deleteAdminPost,
  deleteAdminTag,
  listAdminCategories,
  listAdminPosts,
  listAdminTags,
  listMediaAssets,
  updateAdminCategory,
  updateAdminTag,
  updateMediaAssetMeta,
  uploadMediaAsset,
} from "./lib/api";
import { ErrorMessage, ShellCard, formatDate } from "./ui";

const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5173";

type CategoryDraft = {
  name: string;
  slug: string;
  description: string;
  parentId: string;
};

type TagDraft = {
  name: string;
  slug: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
};

const EMPTY_CATEGORY_DRAFT: CategoryDraft = {
  name: "",
  slug: "",
  description: "",
  parentId: "",
};

const EMPTY_TAG_DRAFT: TagDraft = {
  name: "",
  slug: "",
  description: "",
  seoTitle: "",
  seoDescription: "",
};

function statusVariant(status: PostStatus) {
  if (status === "published") return "published";
  if (status === "draft") return "draft";
  return "archived";
}

function statusLabel(status: PostStatus) {
  if (status === "published") return "발행";
  if (status === "draft") return "초안";
  return "보관";
}

function sortCategoriesForTree(categories: Category[]) {
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

  const ordered: Category[] = [];
  const visit = (category: Category, depth: number) => {
    ordered.push({ ...category, depth } as Category & { depth: number });
    for (const child of children.get(category.id) ?? []) {
      visit(child, depth + 1);
    }
  };

  roots.forEach((root) => visit(root, 0));
  return ordered as Array<Category & { depth: number }>;
}

function topLevelCategories(categories: Category[], excludedId?: string) {
  return categories.filter((category) => !category.parentId && category.id !== excludedId);
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

function getMediaAssetLabel(asset: MediaAsset) {
  return asset.path.split("/").pop() || asset.path;
}

const TAG_QUALITY_LABELS: Record<TagQualityIssue, string> = {
  "missing-description": "소개문 없음",
  "missing-seo-description": "SEO 설명 없음",
  "insufficient-posts": "글 3개 미만",
};

function sortTagsForSeo(left: Tag, right: Tag) {
  const leftIndexCandidate = typeof left.indexCandidate === "boolean" ? left.indexCandidate : computeTagIndexCandidate(left);
  const rightIndexCandidate = typeof right.indexCandidate === "boolean" ? right.indexCandidate : computeTagIndexCandidate(right);
  const leftCount = Number(left.publishedCount ?? 0);
  const rightCount = Number(right.publishedCount ?? 0);

  if (leftIndexCandidate !== rightIndexCandidate) {
    return Number(rightIndexCandidate) - Number(leftIndexCandidate);
  }

  if (leftCount !== rightCount) {
    return rightCount - leftCount;
  }

  return left.name.localeCompare(right.name, "ko");
}

function getTagQualityState(tag: Tag) {
  const qualityIssues = tag.qualityIssues?.length ? tag.qualityIssues : computeTagQualityIssues(tag);
  const indexCandidate = typeof tag.indexCandidate === "boolean" ? tag.indexCandidate : computeTagIndexCandidate(tag);

  return { qualityIssues, indexCandidate };
}

function getTagPreviewUrl(slug: string) {
  return `${PUBLIC_APP_URL}/ko/tag/${slug}`;
}

function buildTagSnippetPreview(draft: TagDraft) {
  const siteTitle = DEFAULT_SITE_SETTINGS.branding.siteTitle;
  const tagName = draft.name.trim() || "태그";
  const slug = draft.slug.trim() || "sample-tag";
  const title = draft.seoTitle.trim() || `${tagName} 관련 글 모음 | ${siteTitle}`;
  const description =
    draft.seoDescription.trim() || draft.description.trim() || `${tagName}와 연결된 공개 글을 모아보는 페이지입니다.`;

  return {
    title,
    description,
    url: getTagPreviewUrl(slug),
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
      <ShellCard title="작업 공간 개요" description="관리자 화면의 핵심 수치를 빠르게 확인합니다.">
        <ErrorMessage message={error} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="전체 글" value={posts.length} />
          <StatCard label="초안" value={posts.filter((post) => post.status === "draft").length} />
          <StatCard label="발행 글" value={posts.filter((post) => post.status === "published").length} />
          <StatCard label="미디어 자산" value={media.length} />
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
                      <Badge variant={statusVariant(post.status)}>{statusLabel(post.status)}</Badge>
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
      setError(reason instanceof Error ? reason.message : "글 삭제에 실패했습니다.");
    }
  };

  return (
    <ShellCard
      title="글"
      description="기존 글을 편집하고 발행 상태를 관리합니다."
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
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={statusVariant(post.status)}>{statusLabel(post.status)}</Badge>
                    <span className="text-sm text-[var(--color-soft-ink)]">{formatDate(post.publishedAt ?? post.updatedAt)}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight">{post.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-soft-ink)]">{post.excerpt || post.subtitle || post.slug}</p>
                  </div>
                  <div className="grid gap-3 text-sm text-[var(--color-soft-ink)] sm:grid-cols-2">
                    <div className="rounded-[20px] bg-[var(--color-paper-muted)] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-soft-ink)]">슬러그</p>
                      <p className="mt-2 break-all text-[var(--color-ink)]">{post.slug}</p>
                    </div>
                    <div className="rounded-[20px] bg-[var(--color-paper-muted)] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-soft-ink)]">카테고리</p>
                      <p className="mt-2 text-[var(--color-ink)]">{post.category?.name ?? "카테고리 없음"}</p>
                    </div>
                  </div>
                </div>

                <div className="xl:w-[15rem] xl:min-w-[15rem]">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                    <Button asChild variant="soft" className="h-10 w-full justify-center text-sm">
                      <Link to={`/posts/${post.id}/edit`}>
                        <PenSquare className="h-4 w-4" />
                        수정
                      </Link>
                    </Button>
                    <Button variant="outline" asChild className="h-10 w-full justify-center text-sm">
                      <a href={`${PUBLIC_APP_URL}/ko/post/${post.slug}`} target="_blank" rel="noreferrer">
                        미리보기
                      </a>
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="mt-3 h-10 w-full justify-center text-sm"
                    onClick={() => void handleDelete(post.id)}
                  >
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
          아직 글이 없습니다. 위 버튼으로 첫 글을 만들어 보세요.
        </div>
      )}
    </ShellCard>
  );
}

export function MediaPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  const [postSlug, setPostSlug] = useState("");
  const [altText, setAltText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingAssetId, setSavingAssetId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const items = await listMediaAssets();
      setAssets(items);
      setAltDrafts(Object.fromEntries(items.map((asset) => [asset.id, asset.altText ?? ""])));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "미디어를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setError("업로드할 파일을 먼저 선택해 주세요.");
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
      if (input) input.value = "";
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "미디어 업로드에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAltText = async (assetId: string) => {
    setSavingAssetId(assetId);
    setError(null);

    try {
      const updated = await updateMediaAssetMeta(assetId, { altText: altDrafts[assetId] ?? null });
      setAssets((current) => current.map((asset) => (asset.id === assetId ? updated : asset)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ALT 저장에 실패했습니다.");
    } finally {
      setSavingAssetId(null);
    }
  };

  return (
    <ShellCard title="미디어" description="업로드한 이미지 자산과 ALT 텍스트를 관리합니다.">
      <ErrorMessage message={error} />
      <form className="grid gap-4 rounded-[24px] border border-white/70 bg-white/72 p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_12rem]" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-[var(--color-ink)]">파일</span>
            <Input id="media-file-input" type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--color-ink)]">포스트 슬러그</span>
            <Input value={postSlug} onChange={(event) => setPostSlug(event.target.value)} placeholder="선택 사항" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--color-ink)]">기본 ALT</span>
            <Input value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="이미지 설명" />
          </label>
        </div>
        <Button type="submit" disabled={submitting} className="w-full self-end justify-center">
          <ImagePlus className="h-4 w-4" />
          {submitting ? "업로드 중..." : "업로드"}
        </Button>
      </form>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {assets.map((asset) => (
          <div key={asset.id} className="rounded-[24px] border border-white/70 bg-white/74 p-4 shadow-sm">
            <div className="flex gap-4">
              <img src={asset.url} alt={asset.altText ?? getMediaAssetLabel(asset)} className="h-28 w-28 rounded-[18px] object-cover" />
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="truncate text-sm font-medium text-[var(--color-ink)]">{getMediaAssetLabel(asset)}</p>
                  <p className="text-xs text-[var(--color-soft-ink)]">{formatDate(asset.createdAt)}</p>
                </div>
                <Input value={altDrafts[asset.id] ?? ""} onChange={(event) => setAltDrafts((current) => ({ ...current, [asset.id]: event.target.value }))} placeholder="ALT 텍스트" />
                <Button type="button" variant="outline" onClick={() => void handleUpdateAltText(asset.id)} disabled={savingAssetId === asset.id}>
                  {savingAssetId === asset.id ? "저장 중..." : "ALT 저장"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_CATEGORY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      setCategories(await listAdminCategories());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "카테고리를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const orderedCategories = useMemo(() => sortCategoriesForTree(categories), [categories]);
  const availableParents = useMemo(() => topLevelCategories(categories, editingId ?? undefined), [categories, editingId]);

  const resetDraft = () => {
    setDraft(EMPTY_CATEGORY_DRAFT);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: draft.name.trim(),
        slug: draft.slug.trim() || undefined,
        description: draft.description.trim() || null,
        parentId: draft.parentId || null,
      };

      if (editingId) {
        await updateAdminCategory(editingId, payload);
      } else {
        await createAdminCategory(payload);
      }

      resetDraft();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "카테고리 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setDraft({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      parentId: category.parentId ?? "",
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 카테고리를 삭제할까요?")) return;

    try {
      await deleteAdminCategory(id);
      if (editingId === id) resetDraft();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "카테고리 삭제에 실패했습니다.");
    }
  };

  return (
    <ShellCard title="카테고리" description="루트와 하위 카테고리 구조를 관리합니다.">
      <ErrorMessage message={error} />
      <form className="grid gap-4 rounded-[24px] border border-white/70 bg-white/72 p-5 shadow-sm lg:grid-cols-2" onSubmit={handleSubmit}>
        <label className="space-y-2">
          <span className="text-sm font-medium text-[var(--color-ink)]">이름</span>
          <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-[var(--color-ink)]">슬러그</span>
          <Input value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} placeholder="비워 두면 자동 생성" />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-[var(--color-ink)]">설명</span>
          <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-[var(--color-ink)]">상위 카테고리</span>
          <Select value={draft.parentId} onChange={(event) => setDraft((current) => ({ ...current, parentId: event.target.value }))}>
            <option value="">루트 카테고리</option>
            {availableParents.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" disabled={saving}>{saving ? "저장 중..." : editingId ? "수정 저장" : "카테고리 추가"}</Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={resetDraft}>취소</Button>
          ) : null}
        </div>
      </form>

      <div className="mt-6 grid gap-4">
        {orderedCategories.map((category) => (
          <div key={category.id} className="rounded-[24px] border border-white/70 bg-white/74 p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">{"— ".repeat((category.depth as number) ?? 0)}{category.name}</h3>
                <p className="text-sm text-[var(--color-soft-ink)]">{category.slug}</p>
                {category.description ? <p className="text-sm text-[var(--color-soft-ink)]">{category.description}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="soft" onClick={() => handleEdit(category)}>수정</Button>
                <Button type="button" variant="ghost" onClick={() => void handleDelete(category.id)}>삭제</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}

export function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [draft, setDraft] = useState<TagDraft>(EMPTY_TAG_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);

  const refresh = async () => {
    try {
      const items = await listAdminTags();
      setTags([...items].sort(sortTagsForSeo));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "태그를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const resetDraft = () => {
    setDraft(EMPTY_TAG_DRAFT);
    setEditingId(null);
  };

  const snippetPreview = useMemo(() => buildTagSnippetPreview(draft), [draft]);
  const stats = useMemo(() => {
    const withPosts = tags.filter((tag) => Number(tag.publishedCount ?? 0) > 0).length;
    const indexReady = tags.filter((tag) => getTagQualityState(tag).indexCandidate).length;
    const needsWork = tags.filter((tag) => getTagQualityState(tag).qualityIssues.length > 0).length;

    return {
      total: tags.length,
      withPosts,
      indexReady,
      needsWork,
    };
  }, [tags]);
  const visibleTags = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("ko-KR");

    return [...tags]
      .filter((tag) => (hideEmpty ? Number(tag.publishedCount ?? 0) > 0 : true))
      .filter((tag) => {
        if (!query) {
          return true;
        }

        return [tag.name, tag.slug, tag.description, tag.seoTitle, tag.seoDescription, tag.topPostTitle]
          .filter(Boolean)
          .map((value) => String(value).toLocaleLowerCase("ko-KR"))
          .some((value) => value.includes(query));
      })
      .sort(sortTagsForSeo);
  }, [hideEmpty, searchQuery, tags]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: draft.name.trim(),
        slug: draft.slug.trim() || undefined,
        description: draft.description.trim() || null,
        seoTitle: draft.seoTitle.trim() || null,
        seoDescription: draft.seoDescription.trim() || null,
      };

      if (editingId) {
        await updateAdminTag(editingId, payload);
      } else {
        await createAdminTag(payload);
      }

      resetDraft();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "태그 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setDraft({
      name: tag.name,
      slug: tag.slug,
      description: tag.description ?? "",
      seoTitle: tag.seoTitle ?? "",
      seoDescription: tag.seoDescription ?? "",
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 태그를 삭제할까요?")) return;

    try {
      await deleteAdminTag(id);
      if (editingId === id) resetDraft();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "태그 삭제에 실패했습니다.");
    }
  };

  return (
    <ShellCard title="태그" description="태그 소개문, 검색 스니펫, 색인 후보 상태를 함께 관리합니다.">
      <ErrorMessage message={error} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="전체 태그" value={stats.total} />
        <StatCard label="공개 글이 있는 태그" value={stats.withPosts} />
        <StatCard label="색인 가능 태그" value={stats.indexReady} />
        <StatCard label="보완 필요한 태그" value={stats.needsWork} />
      </div>

      <form className="mt-6 grid gap-4 rounded-[24px] border border-white/70 bg-white/72 p-5 shadow-sm" onSubmit={handleSubmit}>
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-[24px] border border-white/70 bg-white/80 p-5">
            <p className="section-kicker">기본 정보</p>
            <div className="mt-4 grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--color-ink)]">이름</span>
                <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--color-ink)]">슬러그</span>
                <Input
                  value={draft.slug}
                  onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))}
                  placeholder="비워 두면 자동 생성"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--color-ink)]">태그 소개문</span>
                <Textarea
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  rows={5}
                  placeholder="태그 페이지 상단에 노출할 소개문을 입력합니다."
                />
              </label>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/70 bg-white/80 p-5">
            <p className="section-kicker">SEO 작성</p>
            <div className="mt-4 grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--color-ink)]">SEO 제목</span>
                <Input
                  value={draft.seoTitle}
                  onChange={(event) => setDraft((current) => ({ ...current, seoTitle: event.target.value }))}
                  placeholder="예: Copilot 관련 글 모음 | 동그리의 기록소"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--color-ink)]">SEO 설명</span>
                <Textarea
                  value={draft.seoDescription}
                  onChange={(event) => setDraft((current) => ({ ...current, seoDescription: event.target.value }))}
                  rows={5}
                  placeholder="검색 결과에 노출될 설명을 입력합니다."
                />
              </label>
              <div className="rounded-[20px] bg-[var(--color-paper-muted)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-soft-ink)]">검색 스니펫 미리보기</p>
                <p className="mt-3 text-lg font-semibold leading-6 text-[#1a0dab]">{snippetPreview.title}</p>
                <p className="mt-1 break-all text-sm text-[#0b8043]">{snippetPreview.url}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-soft-ink)]">{snippetPreview.description}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" disabled={saving}>{saving ? "저장 중..." : editingId ? "수정 저장" : "태그 추가"}</Button>
          {editingId ? <Button type="button" variant="outline" onClick={resetDraft}>취소</Button> : null}
        </div>
      </form>

      <div className="mt-6 grid gap-4 rounded-[24px] border border-white/70 bg-white/72 p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_14rem] xl:items-end">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--color-ink)]">검색</span>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="이름, 슬러그, 소개문, SEO 문구, 대표 글 제목 검색"
            />
          </label>
          <label className="flex h-11 items-center gap-3 rounded-full border border-white/70 bg-white/80 px-4 text-sm font-medium text-[var(--color-ink)]">
            <input
              type="checkbox"
              checked={hideEmpty}
              onChange={(event) => setHideEmpty(event.target.checked)}
              className="h-4 w-4 rounded border border-[var(--color-border)]"
            />
            빈 태그 숨김
          </label>
        </div>
        <p className="text-sm text-[var(--color-soft-ink)]">표시 중 {visibleTags.length}개 / 전체 {tags.length}개</p>
      </div>

      <div className="mt-6 grid gap-4">
        {visibleTags.length ? visibleTags.map((tag) => {
          const { qualityIssues, indexCandidate } = getTagQualityState(tag);
          const previewUrl = getTagPreviewUrl(tag.slug);
          const hasPreviewCopy = Boolean((tag.description ?? "").trim() || (tag.seoDescription ?? "").trim());

          return (
            <div key={tag.id} className="rounded-[24px] border border-white/70 bg-white/74 p-5 shadow-sm">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {indexCandidate ? <Badge variant="published">색인 가능</Badge> : null}
                    {qualityIssues.map((issue) => (
                      <Badge key={`${tag.id}-${issue}`} variant="draft">
                        {TAG_QUALITY_LABELS[issue]}
                      </Badge>
                    ))}
                  </div>

                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">#{tag.name}</h3>
                    <p className="mt-2 break-all text-sm text-[var(--color-soft-ink)]">{tag.slug}</p>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-[20px] bg-[var(--color-paper-muted)] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-soft-ink)]">태그 소개문</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-ink)]">
                        {tag.description?.trim() || "소개문이 없습니다."}
                      </p>
                    </div>
                    <div className="rounded-[20px] bg-[var(--color-paper-muted)] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-soft-ink)]">SEO 설명</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-ink)]">
                        {tag.seoDescription?.trim() || "SEO 설명이 없습니다."}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[9rem_11rem_minmax(0,1fr)]">
                    <div className="rounded-[20px] bg-[var(--color-paper-muted)] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-soft-ink)]">공개 글 수</p>
                      <p className="mt-2 text-base font-semibold text-[var(--color-ink)]">{Number(tag.publishedCount ?? 0)}</p>
                    </div>
                    <div className="rounded-[20px] bg-[var(--color-paper-muted)] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-soft-ink)]">최근 발행일</p>
                      <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">
                        {tag.latestPublishedAt ? formatDate(tag.latestPublishedAt) : "발행 이력 없음"}
                      </p>
                    </div>
                    <div className="rounded-[20px] bg-[var(--color-paper-muted)] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-soft-ink)]">대표 글</p>
                      <p className="mt-2 text-sm font-medium leading-6 text-[var(--color-ink)]">
                        {tag.topPostTitle?.trim() || "대표 글이 아직 없습니다."}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[20px] bg-[var(--color-paper-muted)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-soft-ink)]">퍼블릭 미리보기</p>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block break-all text-sm font-medium text-[var(--color-ink)] underline decoration-[var(--color-border)] underline-offset-4"
                    >
                      {previewUrl}
                    </a>
                    {!hasPreviewCopy ? (
                      <p className="mt-2 text-sm text-[var(--color-soft-ink)]">소개문과 SEO 설명을 채우면 검색 미리보기 품질이 올라갑니다.</p>
                    ) : null}
                  </div>
                </div>

                <div className="xl:w-[15rem] xl:min-w-[15rem]">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                    <Button type="button" variant="soft" className="h-10 w-full justify-center text-sm" onClick={() => handleEdit(tag)}>
                      수정
                    </Button>
                    <Button variant="outline" asChild className="h-10 w-full justify-center text-sm">
                      <a href={previewUrl} target="_blank" rel="noreferrer">
                        퍼블릭 미리보기
                      </a>
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-3 h-10 w-full justify-center text-sm"
                    onClick={() => void handleDelete(tag.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="rounded-[24px] bg-[var(--color-paper-muted)] px-5 py-8 text-[var(--color-soft-ink)]">
            조건에 맞는 태그가 없습니다. 검색어나 빈 태그 숨김 설정을 확인해 주세요.
          </div>
        )}
      </div>
    </ShellCard>
  );
}
