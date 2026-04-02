import type { Category, PostStatus, UpsertPostBySlugInput, UpsertPostBySlugResult } from "@cloudflare-blog/shared";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import { buildCategoryLabel, sortCategoriesForTree } from "./lib/category-utils";
import { listAdminCategories, upsertAdminPostBySlugManual } from "./lib/api";
import { Button, ErrorMessage, ShellCard, toIsoValue } from "./ui";

const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5173";

type AutomationFormState = {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  categoryId: string;
  tagNamesInput: string;
  coverImage: string;
  coverAlt: string;
  status: PostStatus;
  publishedAt: string;
};

const EMPTY_FORM: AutomationFormState = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  categoryId: "",
  tagNamesInput: "",
  coverImage: "",
  coverAlt: "",
  status: "draft",
  publishedAt: "",
};

function parseTagNames(value: string) {
  const deduped = new Map<string, string>();

  for (const raw of value.split(",")) {
    const name = raw.replace(/^#+/g, "").trim().replace(/\s+/g, " ");

    if (!name) {
      continue;
    }

    const key = name.toLocaleLowerCase("ko-KR");

    if (!deduped.has(key)) {
      deduped.set(key, name);
    }
  }

  return [...deduped.values()].slice(0, 10);
}

export function AutomationPage() {
  const [form, setForm] = useState<AutomationFormState>(EMPTY_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<UpsertPostBySlugResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void listAdminCategories()
      .then((items) => {
        setCategories(items);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "카테고리 로딩에 실패했습니다."));
  }, []);

  const selectableCategories = useMemo(() => sortCategoriesForTree(categories), [categories]);
  const normalizedTags = useMemo(() => parseTagNames(form.tagNamesInput), [form.tagNamesInput]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const payload: UpsertPostBySlugInput = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        content: form.content,
        excerpt: form.excerpt.trim() || null,
        categoryId: form.categoryId || null,
        tagNames: normalizedTags,
        coverImage: form.coverImage.trim() || null,
        coverAlt: form.coverAlt.trim() || null,
        status: form.status,
        publishedAt: toIsoValue(form.publishedAt),
      };

      const saved = await upsertAdminPostBySlugManual(payload);
      setResult(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "수동 자동화 발행에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ShellCard
      title="자동화 발행 (수동 보조)"
      description="외부 자동화와 동일한 slug upsert 동작을 관리자 세션으로 수동 실행합니다."
    >
      <form className="grid gap-5 xl:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block">
          <span className="field-label">제목</span>
          <Input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
          />
        </label>

        <label className="block">
          <span className="field-label">슬러그</span>
          <Input
            value={form.slug}
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            placeholder="예: geo-seo-cloudflare-update"
            required
          />
        </label>

        <label className="block xl:col-span-2">
          <span className="field-label">본문</span>
          <Textarea
            rows={14}
            value={form.content}
            onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
            placeholder={"## 핵심 요약\n\n본문 내용을 입력하세요."}
            required
          />
        </label>

        <label className="block xl:col-span-2">
          <span className="field-label">요약</span>
          <Textarea
            rows={4}
            value={form.excerpt}
            onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
            placeholder="카드/검색/메타에 사용할 요약"
          />
        </label>

        <label className="block">
          <span className="field-label">카테고리</span>
          <Select
            value={form.categoryId}
            onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
          >
            <option value="">카테고리 없음</option>
            {selectableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {buildCategoryLabel(category, categories)}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <span className="field-label">태그 (쉼표 구분)</span>
          <Input
            value={form.tagNamesInput}
            onChange={(event) => setForm((current) => ({ ...current, tagNamesInput: event.target.value }))}
            placeholder="cloudflare, seo, automation"
          />
          <p className="field-hint">저장 시 중복 제거 후 최대 10개를 반영합니다.</p>
        </label>

        <label className="block">
          <span className="field-label">커버 이미지 URL</span>
          <Input
            value={form.coverImage}
            onChange={(event) => setForm((current) => ({ ...current, coverImage: event.target.value }))}
            placeholder="https://..."
          />
        </label>

        <label className="block">
          <span className="field-label">커버 대체 텍스트</span>
          <Input
            value={form.coverAlt}
            onChange={(event) => setForm((current) => ({ ...current, coverAlt: event.target.value }))}
          />
        </label>

        <label className="block">
          <span className="field-label">상태</span>
          <Select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PostStatus }))}
          >
            <option value="draft">초안</option>
            <option value="published">발행</option>
            <option value="archived">보관</option>
          </Select>
        </label>

        <label className="block">
          <span className="field-label">발행 일시</span>
          <Input
            type="datetime-local"
            value={form.publishedAt}
            onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))}
          />
        </label>

        <div className="xl:col-span-2">
          <ErrorMessage message={error} />
        </div>

        <div className="xl:col-span-2 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "실행 중..." : "수동 Upsert 실행"}
          </Button>
          {result ? (
            <>
              <span className="text-sm font-medium text-[var(--color-ink)]">
                완료: <strong>{result.operation}</strong> / <code>{result.post.slug}</code>
              </span>
              <Button asChild variant="soft">
                <Link to={`/posts/${result.post.id}/edit`}>에디터로 이동</Link>
              </Button>
              <Button asChild variant="outline">
                <a href={`${PUBLIC_APP_URL}/ko/post/${result.post.slug}`} target="_blank" rel="noreferrer">
                  퍼블릭 보기
                </a>
              </Button>
            </>
          ) : null}
        </div>
      </form>
    </ShellCard>
  );
}
