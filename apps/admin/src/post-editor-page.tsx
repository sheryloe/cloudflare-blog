import type {
  Category,
  CreatePostInput,
  MediaAsset,
  Post,
  PostStatus,
  RelatedLink,
} from "@cloudflare-blog/shared";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleAlert,
  Copy,
  Blocks,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  ImagePlus,
  Images,
  Link2,
  Trash2,
} from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { MarkdownEditor, type MarkdownEditorHandle } from "./components/markdown-editor";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./components/ui/sheet";
import { Textarea } from "./components/ui/textarea";
import {
  ApiError,
  createAdminPost,
  getAdminPost,
  listAdminCategories,
  listMediaAssets,
  previewAdminRelatedLink,
  updateAdminPost,
  uploadMediaAsset,
} from "./lib/api";
import { buildCategoryLabel, sortCategoriesForTree } from "./lib/category-utils";
import { ErrorMessage, LoadingPanel, ShellCard, toDateInputValue, toIsoValue } from "./ui";

type BodyImageWidth = "narrow" | "default" | "wide";
type BodyImageAlign = "left" | "center" | "full";
type SeoStatus = "good" | "warn" | "bad";
type WritingTemplate = {
  id: string;
  label: string;
  description: string;
  markdown: string;
};

type PostFormState = {
  title: string;
  subtitle: string;
  slug: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  content: string;
  categoryId: string;
  tagNamesInput: string;
  coverImage: string;
  coverAlt: string;
  youtubeUrl: string;
  status: PostStatus;
  publishedAt: string;
  relatedLinks: RelatedLink[];
};

type EditableImageMeta = {
  alt: string;
  caption: string;
  align: BodyImageAlign;
  width: BodyImageWidth;
  start: number;
  end: number;
  src: string;
};

const EMPTY_POST_FORM: PostFormState = {
  title: "",
  subtitle: "",
  slug: "",
  excerpt: "",
  seoTitle: "",
  seoDescription: "",
  content: "",
  categoryId: "",
  tagNamesInput: "",
  coverImage: "",
  coverAlt: "",
  youtubeUrl: "",
  status: "draft",
  publishedAt: "",
  relatedLinks: [],
};

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const MAX_IMAGE_UPLOAD_SIZE = 10 * 1024 * 1024;
const RELATED_LINK_LIMIT = 5;

const BODY_IMAGE_PRESETS: Array<{
  id: BodyImageWidth;
  label: string;
  description: string;
  align: BodyImageAlign;
}> = [
  { id: "narrow", label: "좁게", description: "작은 보조 이미지", align: "left" },
  { id: "default", label: "기본", description: "본문 기본 이미지", align: "center" },
  { id: "wide", label: "넓게", description: "강조형 본문 이미지", align: "full" },
];

const WRITING_TEMPLATES: WritingTemplate[] = [
  {
    id: "hook",
    label: "CTR 오프닝 블록",
    description: "독자 관심을 끄는 시작 문단",
    markdown: `\n독자가 바로 공감할 수 있는 질문으로 글을 시작해보세요.\n\n> 왜 이 글이 지금 필요한지 2~3문장으로 정리합니다.\n`,
  },
  {
    id: "summary",
    label: "한 줄 핵심 요약",
    description: "글의 결론을 바로 제시하는 박스형 문장",
    markdown: "\n**핵심 요약:**\n- \n- \n- \n",
  },
  {
    id: "faq-block",
    label: "FAQ 보조 블록",
    description: "검색 유입을 위한 구조화 문단",
    markdown: "\n## 자주 묻는 질문\n\n### Q. \n### A. \n\n### Q. \n### A. \n",
  },
  {
    id: "toc",
    label: "GEO용 섹션 뼈대",
    description: "장문 글 목차 구성용 블록",
    markdown: "\n## 글 목차\n\n1. \n2. \n3. \n",
  },
  {
    id: "faq",
    label: "FAQ 블록",
    description: "검색 유입에 유리한 Q&A 구조 블록",
    markdown: "\n## 자주 묻는 질문\n\n### Q. 이 글의 핵심 문제는 무엇인가요?\n- \n\n### A. \n\n### Q. 어떤 근거로 정리했나요?\n- \n\n### A. \n",
  },
  {
    id: "howto",
    label: "How-to 가이드",
    description: "실행형 블로그 글에 유리한 단계형 설명",
    markdown: "\n## 실천 가이드\n\n### 준비 단계\n- \n\n### 핵심 단계\n1. \n2. \n3. \n\n### 점검 포인트\n- \n",
  },
  {
    id: "geo-summary",
    label: "GEO용 결론 요약",
    description: "요약 + 핵심 키워드 + 연관 탐색 동선",
    markdown:
      "\n## 결론 요약\n\n### 핵심 한 줄\n- \n\n### 핵심 키워드\n- \n\n### 다음에 읽어야 할 글\n- \n",
  },
];

const OPEN_SOURCE_EDITOR_TOOLS = [
  {
    name: "Toast UI Editor",
    note: "현재 적용 중. 오픈소스 무료 버전으로 마크다운+WYSIWYG 둘 다 지원.",
  },
  {
    name: "Milkdown / ProseMirror",
    note: "구조화 블록 편집(칸반형 문단) 기반으로 확대 시 대체 옵션.",
  },
  {
    name: "tiptap",
    note: "협업형 문서 체감이 높은 확장 편집기. 확장성은 좋지만 현재 운영에는 과하므로 보류.",
  },
];

const SEO_TITLE_MIN = 24;
const SEO_TITLE_MAX = 55;
const SEO_EXCERPT_MIN = 90;
const SEO_EXCERPT_MAX = 170;

function mapPostToForm(post: Post): PostFormState {
  return {
    title: post.title,
    subtitle: post.subtitle ?? "",
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
    content: post.content,
    categoryId: post.category?.id ?? "",
    tagNamesInput: post.tags.map((tag) => tag.name).join(", "),
    coverImage: post.coverImage ?? "",
    coverAlt: post.coverAlt ?? "",
    youtubeUrl: post.youtubeUrl ?? "",
    status: post.status,
    publishedAt: toDateInputValue(post.publishedAt),
    relatedLinks: normalizeRelatedLinks(post.relatedLinks ?? []),
  };
}

function parseTagInputValue(value: string) {
  const normalized = new Map<string, string>();

  for (const rawTag of value.split(",")) {
    const name = rawTag.replace(/^#+/g, "").trim().replace(/\s+/g, " ");

    if (!name) {
      continue;
    }

    const key = name.toLocaleLowerCase("ko-KR");

    if (!normalized.has(key)) {
      normalized.set(key, name);
    }
  }

  return [...normalized.values()];
}

function normalizeRelatedLinks(links: RelatedLink[]) {
  return links
    .map((link) => ({
      url: link.url?.trim() ?? "",
      title: link.title?.trim() || undefined,
      description: link.description?.trim() || undefined,
      image: link.image?.trim() || undefined,
      siteName: link.siteName?.trim() || undefined,
    }))
    .filter((link) => link.url.length > 0)
    .slice(0, RELATED_LINK_LIMIT);
}

function buildPostInput(form: PostFormState): CreatePostInput {
  return {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    slug: form.slug.trim() || undefined,
    excerpt: form.excerpt.trim() || null,
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
    content: form.content,
    categoryId: form.categoryId || null,
    tagNames: parseTagInputValue(form.tagNamesInput),
    coverImage: form.coverImage || null,
    coverAlt: form.coverAlt.trim() || null,
    youtubeUrl: form.youtubeUrl.trim() || null,
    status: form.status,
    publishedAt: toIsoValue(form.publishedAt),
    relatedLinks: normalizeRelatedLinks(form.relatedLinks),
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeAlign(value: string): BodyImageAlign {
  if (value === "left" || value === "center" || value === "full") {
    return value;
  }

  return "center";
}

function normalizeWidth(value: string): BodyImageWidth {
  if (value === "narrow" || value === "default" || value === "wide") {
    return value;
  }

  return "default";
}

function extractMarkdownSrc(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("<") && trimmed.includes(">")) {
    return trimmed.slice(1, trimmed.indexOf(">")).trim();
  }

  return trimmed.split(/\s+/)[0] ?? "";
}

function parseEditableImages(content: string): EditableImageMeta[] {
  const items: EditableImageMeta[] = [];
  const figureRegex = /<figure\b[^>]*>[\s\S]*?<img\b[^>]*>[\s\S]*?<\/figure>/gi;
  let figureMatch: RegExpExecArray | null = null;

  while ((figureMatch = figureRegex.exec(content)) !== null) {
    const chunk = figureMatch[0];
    const imgMatch = /<img\b[^>]*>/i.exec(chunk);

    if (!imgMatch) {
      continue;
    }

    const figureAlign = /data-align\s*=\s*(['"])(.*?)\1/i.exec(chunk)?.[2] ?? "center";
    const figureWidth = /data-width\s*=\s*(['"])(.*?)\1/i.exec(chunk)?.[2] ?? "default";
    const src = /\bsrc\s*=\s*(['"])(.*?)\1/i.exec(imgMatch[0])?.[2] ?? "";
    const alt = /\balt\s*=\s*(['"])(.*?)\1/i.exec(imgMatch[0])?.[2] ?? "";
    const caption = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i.exec(chunk)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";

    items.push({
      src,
      alt,
      caption,
      width: normalizeWidth(figureWidth),
      align: normalizeAlign(figureAlign),
      start: figureMatch.index,
      end: figureMatch.index + chunk.length,
    });
  }

  const markdownRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let markdownMatch: RegExpExecArray | null = null;

  while ((markdownMatch = markdownRegex.exec(content)) !== null) {
    items.push({
      alt: markdownMatch[1]?.trim() ?? "",
      caption: "",
      width: "default",
      align: "center",
      src: extractMarkdownSrc(markdownMatch[2] ?? ""),
      start: markdownMatch.index,
      end: markdownMatch.index + markdownMatch[0].length,
    });
  }

  return items.sort((left, right) => left.start - right.start);
}

function buildFigureImage(meta: Pick<EditableImageMeta, "src" | "alt" | "caption" | "align" | "width">) {
  const lines = [
    `<figure data-media-block="true" data-align="${meta.align}" data-width="${meta.width}">`,
    `  <img src="${escapeHtml(meta.src)}" alt="${escapeHtml(meta.alt.trim())}" loading="lazy" />`,
  ];

  if (meta.caption.trim()) {
    lines.push(`  <figcaption>${escapeHtml(meta.caption.trim())}</figcaption>`);
  }

  lines.push("</figure>");
  return lines.join("\n");
}

function updateImageAtIndex(
  content: string,
  index: number,
  nextMeta: Pick<EditableImageMeta, "src" | "alt" | "caption" | "align" | "width">,
) {
  const images = parseEditableImages(content);
  const target = images[index];

  if (!target) {
    return content;
  }

  return `${content.slice(0, target.start)}${buildFigureImage(nextMeta)}${content.slice(target.end)}`;
}

function getUploadErrorMessage(reason: unknown) {
  if (reason instanceof ApiError) {
    if (reason.code === "UNSUPPORTED_MEDIA_TYPE") {
      return "지원하지 않는 파일 형식입니다. JPEG, PNG, WebP, GIF, AVIF만 업로드할 수 있습니다.";
    }

    if (reason.code === "FILE_TOO_LARGE") {
      return "파일 용량이 너무 큽니다. 10MB 이하 파일만 업로드할 수 있습니다.";
    }

    if (reason.code === "INVALID_FILE") {
      return "파일을 다시 선택해 주세요.";
    }
  }

  return reason instanceof Error ? reason.message : "이미지 업로드에 실패했습니다.";
}

function buildPresetPayload(width: BodyImageWidth) {
  const preset = BODY_IMAGE_PRESETS.find((item) => item.id === width) ?? BODY_IMAGE_PRESETS[1];

  return {
    width: preset.id,
    align: preset.align,
  } as const;
}

function getMediaAssetLabel(asset: MediaAsset) {
  return asset.path.split("/").pop() || asset.path;
}

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const INITIAL_ROMAN = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const VOWEL_ROMAN = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const FINAL_ROMAN = ["", "k", "k", "ks", "n", "nj", "nh", "t", "l", "lk", "lm", "lb", "ls", "lt", "lp", "lh", "m", "p", "ps", "t", "t", "ng", "t", "t", "k", "t", "p", "h"];

function romanizeHangulSyllable(char: string) {
  const code = char.charCodeAt(0);

  if (code < HANGUL_BASE || code > HANGUL_LAST) {
    return char;
  }

  const syllableIndex = code - HANGUL_BASE;
  const initialIndex = Math.floor(syllableIndex / 588);
  const vowelIndex = Math.floor((syllableIndex % 588) / 28);
  const finalIndex = syllableIndex % 28;

  return `${INITIAL_ROMAN[initialIndex]}${VOWEL_ROMAN[vowelIndex]}${FINAL_ROMAN[finalIndex]}`;
}

function romanizeKorean(value: string) {
  let result = "";

  for (const char of value.normalize("NFKC")) {
    const code = char.charCodeAt(0);

    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      result += romanizeHangulSyllable(char);
      continue;
    }

    if (/[a-zA-Z0-9]/.test(char)) {
      result += char;
      continue;
    }

    if (/\s|[-_/]+/.test(char)) {
      result += " ";
    }
  }

  return result;
}

function buildSlugFromTitle(value: string) {
  return romanizeKorean(value)
    .trim()
    .toLowerCase()
    .replace(/\/+/g, " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function stripMarkdownForText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "이미지")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/`{1,3}/g, "")
    .replace(/\*{1,3}|\_+/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildExcerptFromContent(content: string) {
  const plain = stripMarkdownForText(content);
  if (!plain) {
    return "";
  }

  const max = 170;
  if (plain.length <= max) {
    return plain;
  }

  return `${plain.slice(0, max - 1).trimEnd()}…`;
}

export function PostEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<PostFormState>(EMPTY_POST_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [mediaSheetOpen, setMediaSheetOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<"content" | "cover">("content");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [bodyImagePreset, setBodyImagePreset] = useState<BodyImageWidth>("default");
  const [fetchingRelatedLinkIndex, setFetchingRelatedLinkIndex] = useState<number | null>(null);

  useEffect(() => {
    void Promise.all([listAdminCategories(), listMediaAssets(), isEdit && id ? getAdminPost(id) : Promise.resolve(null)])
      .then(([categoryItems, mediaItems, post]) => {
        setCategories(categoryItems);
        setMedia(mediaItems);
        setForm(post ? mapPostToForm(post) : EMPTY_POST_FORM);
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const selectableCategories = useMemo(() => sortCategoriesForTree(categories), [categories]);
  const editableImages = useMemo(() => parseEditableImages(form.content), [form.content]);
  const selectedEditableImage = editableImages[selectedImageIndex] ?? null;
  const selectedCover = media.find((asset) => asset.url === form.coverImage) ?? null;
  const canAddRelatedLink = form.relatedLinks.length < RELATED_LINK_LIMIT;

  useEffect(() => {
    if (!editableImages.length) {
      setSelectedImageIndex(0);
      return;
    }

    if (selectedImageIndex >= editableImages.length) {
      setSelectedImageIndex(editableImages.length - 1);
    }
  }, [editableImages, selectedImageIndex]);

  const mergeAsset = (asset: MediaAsset) => {
    setMedia((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
  };

  const insertAssetIntoContent = (asset: MediaAsset) => {
    const preset = buildPresetPayload(bodyImagePreset);
    editorRef.current?.focus();
    editorRef.current?.insertImage({
      url: asset.url,
      altText: asset.altText,
      width: preset.width,
      align: preset.align,
    });
  };

  const handleAssetUpload = async (file: File, target: "content" | "cover") => {
    setUploadingImage(true);
    setError(null);

    try {
      const asset = await uploadMediaAsset({
        file,
        postSlug: form.slug.trim() || form.title.trim() || "draft",
        altText: file.name.replace(/\.[^.]+$/, ""),
      });

      mergeAsset(asset);

      if (target === "cover") {
        setForm((current) => ({
          ...current,
          coverImage: asset.url,
          coverAlt: current.coverAlt || asset.altText || "",
        }));
      } else {
        insertAssetIntoContent(asset);
      }

      return asset;
    } catch (reason) {
      const message = getUploadErrorMessage(reason);
      setError(message);
      throw reason;
    } finally {
      setUploadingImage(false);
    }
  };

  const openFilePicker = (target: "content" | "cover") => {
    setUploadTarget(target);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!IMAGE_MIME_TYPES.has(file.type)) {
      setError("지원하지 않는 파일 형식입니다. JPEG, PNG, WebP, GIF, AVIF만 업로드할 수 있습니다.");
      return;
    }

    if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
      setError("파일 용량이 너무 큽니다. 10MB 이하 파일만 업로드할 수 있습니다.");
      return;
    }

    try {
      await handleAssetUpload(file, uploadTarget);
    } catch {
      // handled by handleAssetUpload
    }
  };

  const handleSelectMediaAsset = (asset: MediaAsset) => {
    if (uploadTarget === "cover") {
      setForm((current) => ({
        ...current,
        coverImage: asset.url,
        coverAlt: current.coverAlt || asset.altText || "",
      }));
    } else {
      insertAssetIntoContent(asset);
    }

    setMediaSheetOpen(false);
  };

  const handleImageMetaChange = (
    field: keyof Pick<EditableImageMeta, "alt" | "caption" | "align" | "width">,
    value: string,
  ) => {
    if (!selectedEditableImage) {
      return;
    }

    const nextMeta: EditableImageMeta = {
      ...selectedEditableImage,
      [field]: field === "align" ? normalizeAlign(value) : field === "width" ? normalizeWidth(value) : value,
    } as EditableImageMeta;

    setForm((current) => ({
      ...current,
      content: updateImageAtIndex(current.content, selectedImageIndex, nextMeta),
    }));
  };

  const handleRelatedLinkPreviewAt = async (index: number) => {
    const url = form.relatedLinks[index]?.url?.trim();

    if (!url) {
      setError("관련 링크 URL을 먼저 입력해 주세요.");
      return;
    }

    setFetchingRelatedLinkIndex(index);
    setError(null);

    try {
      const preview = await previewAdminRelatedLink(url);
      setForm((current) => ({
        ...current,
        relatedLinks: current.relatedLinks.map((item, itemIndex) =>
          itemIndex === index ? { ...preview, url: preview.url || url } : item,
        ),
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "관련 링크 미리 가져오기에 실패했습니다.");
    } finally {
      setFetchingRelatedLinkIndex((current) => (current === index ? null : current));
    }
  };

  const addRelatedLinkRow = () => {
    if (!canAddRelatedLink) {
      return;
    }

    setForm((current) => ({
      ...current,
      relatedLinks: [
        ...current.relatedLinks,
        {
          url: "",
          title: "",
          description: "",
          image: "",
          siteName: "",
        },
      ],
    }));
  };

  const updateRelatedLink = (index: number, field: keyof RelatedLink, value: string) => {
    setForm((current) => ({
      ...current,
      relatedLinks: current.relatedLinks.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const moveRelatedLink = (index: number, direction: -1 | 1) => {
    setForm((current) => {
      const next = [...current.relatedLinks];
      const targetIndex = index + direction;

      if (targetIndex < 0 || targetIndex >= next.length) {
        return current;
      }

      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return { ...current, relatedLinks: next };
    });
  };

  const removeRelatedLink = (index: number) => {
    setForm((current) => ({
      ...current,
      relatedLinks: current.relatedLinks.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const applySlugFromTitle = () => {
    const next = buildSlugFromTitle(form.title);
    setForm((current) => ({
      ...current,
      slug: next,
    }));
  };

  const applySuggestedExcerpt = () => {
    const next = buildExcerptFromContent(form.content);
    if (!next) {
      setError("본문 내용이 부족해 요약문을 생성할 수 없습니다.");
      return;
    }

    setForm((current) => ({
      ...current,
      excerpt: next,
    }));
  };

  const insertTemplate = (template: WritingTemplate["markdown"]) => {
    editorRef.current?.insertMarkdown(template);
  };

  const seoChecks = useMemo(() => {
    const titleLength = (form.seoTitle.trim() || form.title.trim()).length;
    const excerptLength = (form.seoDescription.trim() || form.excerpt.trim()).length;
    const tagCount = parseTagInputValue(form.tagNamesInput).length;
    const titleStatus = (() => {
      if (titleLength >= SEO_TITLE_MIN && titleLength <= SEO_TITLE_MAX) {
        return "good" as SeoStatus;
      }

      return "warn" as SeoStatus;
    })();

    const excerptStatus = (() => {
      if (!form.excerpt.trim()) {
        return "bad";
      }

      if (excerptLength >= SEO_EXCERPT_MIN && excerptLength <= SEO_EXCERPT_MAX) {
        return "good";
      }

      return "warn";
    })();

    const categoryStatus = form.categoryId ? "good" : "bad";
    const coverStatus = form.coverImage ? (form.coverAlt.trim() ? "good" : "warn") : "bad";
    const relatedStatus = form.relatedLinks.some((link) => link.url?.trim()) ? "good" : "warn";

    const details = [
      {
        key: "title",
        label: `제목 길이 (${titleLength}자)`,
        status: titleStatus,
        message:
          titleStatus === "good"
            ? "검색 미리보기에 유리한 길이입니다."
            : `권장 ${SEO_TITLE_MIN}~${SEO_TITLE_MAX}자로 맞추면 CTR에 유리합니다.`,
      },
      {
        key: "excerpt",
        label: `요약문 길이 (${excerptLength || 0}자)`,
        status: excerptStatus,
        message:
          excerptStatus === "good"
            ? "요약문 길이가 적절합니다."
            : excerptLength
              ? `권장 ${SEO_EXCERPT_MIN}~${SEO_EXCERPT_MAX}자 전후를 목표로 조정하세요.`
              : "요약문이 비어 있어 검색 설명이 약해집니다.",
      },
      {
        key: "category",
        label: "카테고리 선택",
        status: categoryStatus,
        message: categoryStatus === "good" ? "카테고리 노출로 내부 링크 확장이 됩니다." : "카테고리 미설정은 분류 신호가 약해집니다.",
      },
      {
        key: "cover",
        label: "대표 이미지",
        status: coverStatus,
        message:
          coverStatus === "good"
            ? "썸네일 + 본문 진입 링크 모두 확보됩니다."
            : "대표 이미지 또는 alt 텍스트를 채워주세요.",
      },
      {
        key: "related",
        label: "관련 링크",
        status: relatedStatus,
        message:
          relatedStatus === "good"
            ? "본문 하단 관련 링크로 체류시간을 확장할 수 있습니다."
            : "최소 1개 정도의 관련 링크를 두면 품질 신호가 좋아집니다.",
      },
      {
        key: "tag",
        label: `태그 (${tagCount}개)`,
        status: tagCount > 0 ? "good" : "warn",
        message:
          tagCount > 0 ? "태그로 유사 주제 연결이 쉬워집니다." : "태그 1~3개를 넣으면 내부 연결성에 도움 됩니다.",
      },
    ];

    const score =
      Math.round(
        (details.filter((item) => item.status === "good").length / details.length) *
          100,
      );

    return { details, score };
  }, [
    form.categoryId,
    form.coverAlt,
    form.coverImage,
    form.excerpt,
    form.relatedLinks.length,
    form.seoDescription,
    form.seoTitle,
    form.title,
    form.tagNamesInput,
  ]);

  const seoColor = seoChecks.score >= 80 ? "var(--color-accent)" : seoChecks.score >= 50 ? "var(--color-soft-ink)" : "#b13d3c";
  const seoPreviewTitle = form.seoTitle.trim() || form.title.trim() || "검색 결과 제목 미리보기";
  const seoPreviewDescription =
    form.seoDescription.trim() ||
    form.excerpt.trim() ||
    form.subtitle.trim() ||
    buildExcerptFromContent(form.content) ||
    "검색 설명 미리보기";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const input = buildPostInput(form);

      if (isEdit && id) {
        await updateAdminPost(id, input);
      } else {
        await createAdminPost(input);
      }

      navigate("/posts");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "글 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingPanel message="글 편집 화면을 불러오는 중입니다." />;
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <ShellCard
        title={isEdit ? "글 수정" : "새 글 작성"}
        description="본문은 왼쪽에서 편집하고, 오른쪽 패널에서 대표 이미지, 본문 이미지, 관련 링크, 발행 정보를 관리합니다."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" asChild>
              <Link to="/posts">목록으로</Link>
            </Button>
            <Button type="submit" disabled={saving || uploadingImage}>
              {saving ? "저장 중..." : isEdit ? "수정 저장" : "글 저장"}
            </Button>
          </div>
        }
      >
        <ErrorMessage message={error} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-6">
            <section className="rounded-[24px] border border-white/70 bg-white/72 p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">제목</span>
                  <Input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="글 제목"
                    required
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">부제목</span>
                  <Input
                    value={form.subtitle}
                    onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))}
                    placeholder="선택 사항"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">슬러그</span>
                  <Input
                    value={form.slug}
                    onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                    placeholder="비워 두면 제목 기준 자동 생성"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">유튜브 URL</span>
                  <Input
                    value={form.youtubeUrl}
                    onChange={(event) => setForm((current) => ({ ...current, youtubeUrl: event.target.value }))}
                    placeholder="선택 사항"
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">요약문</span>
                  <Textarea
                    value={form.excerpt}
                    onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
                    rows={4}
                    placeholder="메타 설명과 목록 요약에 사용할 문장"
                  />
                </label>
                <div className="space-y-4 rounded-[18px] border border-[var(--color-line)] bg-[var(--color-paper-muted)] p-4 md:col-span-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-ink)]">검색 노출(CTR)</h3>
                    <p className="mt-1 text-xs text-[var(--color-soft-ink)]">
                      title: `seoTitle` → 제목, description: `seoDescription` → 요약문/부제목/본문 순서로 fallback 됩니다.
                    </p>
                  </div>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-[var(--color-ink)]">SEO 제목 ({form.seoTitle.trim().length}/55)</span>
                    <Input
                      value={form.seoTitle}
                      onChange={(event) => setForm((current) => ({ ...current, seoTitle: event.target.value }))}
                      placeholder="검색 결과 전용 제목 (선택)"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-[var(--color-ink)]">
                      SEO 설명 ({form.seoDescription.trim().length}/170)
                    </span>
                    <Textarea
                      value={form.seoDescription}
                      onChange={(event) => setForm((current) => ({ ...current, seoDescription: event.target.value }))}
                      rows={3}
                      placeholder="검색 결과 전용 설명 (선택)"
                    />
                  </label>
                  <div className="rounded-[14px] border border-[var(--color-line)] bg-white px-4 py-3">
                    <p className="text-xs font-medium text-[var(--color-soft-ink)]">스니펫 미리보기</p>
                    <p className="mt-1 text-base font-semibold leading-6 text-[#1a0dab]">{seoPreviewTitle}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-soft-ink)]">example.com/ko/post/{form.slug.trim() || "slug"}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--color-ink)]">{seoPreviewDescription}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-white/70 bg-white/72 p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">본문 편집</h2>
                <p className="mt-1 text-sm text-[var(--color-soft-ink)]">
                  오른쪽 패널의 본문 이미지 삽입 버튼으로 프리셋 이미지를 넣고, 아래 에디터에서 글을 이어서 작성합니다.
                </p>
              </div>
              <MarkdownEditor
                ref={editorRef}
                value={form.content}
                onChange={(value) => setForm((current) => ({ ...current, content: value }))}
                placeholder="본문을 입력해 주세요."
                onUploadImage={(file) => handleAssetUpload(file, "content")}
                onError={setError}
              />
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[24px] border border-white/70 bg-white/78 p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-semibold tracking-tight text-[var(--color-ink)]">대표 이미지</h2>
                <p className="mt-1 text-sm text-[var(--color-soft-ink)]">
                  목록 썸네일과 상세 대표 이미지에 함께 사용됩니다.
                </p>
              </div>
              <div className="space-y-4">
                <div className="overflow-hidden rounded-[20px] border border-dashed border-[var(--color-line)] bg-[var(--color-paper-muted)]">
                  {form.coverImage ? (
                    <img
                      src={form.coverImage}
                      alt={form.coverAlt || "대표 이미지 미리보기"}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center px-6 text-center text-sm text-[var(--color-soft-ink)]">
                      아직 대표 이미지가 없습니다.
                    </div>
                  )}
                </div>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">대표 이미지 ALT</span>
                  <Input
                    value={form.coverAlt}
                    onChange={(event) => setForm((current) => ({ ...current, coverAlt: event.target.value }))}
                    placeholder="검색과 접근성을 위한 이미지 설명"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                  <Button type="button" variant="outline" onClick={() => openFilePicker("cover")} disabled={uploadingImage}>
                    <ImagePlus className="h-4 w-4" />
                    업로드
                  </Button>
                  <Button
                    type="button"
                    variant="soft"
                    onClick={() => {
                      setUploadTarget("cover");
                      setMediaSheetOpen(true);
                    }}
                  >
                    <Images className="h-4 w-4" />
                    미디어 선택
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setForm((current) => ({ ...current, coverImage: "", coverAlt: "" }))}
                    disabled={!form.coverImage}
                  >
                    <Trash2 className="h-4 w-4" />
                    제거
                  </Button>
                </div>
                {selectedCover ? (
                  <p className="text-xs text-[var(--color-soft-ink)]">선택된 자산: {getMediaAssetLabel(selectedCover)}</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-[24px] border border-white/70 bg-white/78 p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-semibold tracking-tight text-[var(--color-ink)]">본문 이미지</h2>
                <p className="mt-1 text-sm text-[var(--color-soft-ink)]">
                  삽입 프리셋을 고른 뒤 이미지를 넣고, 아래에서 캡션과 정렬을 바로 수정합니다.
                </p>
              </div>
              <div className="space-y-4">
                <div className="grid gap-2">
                  {BODY_IMAGE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setBodyImagePreset(preset.id)}
                      className={`rounded-[18px] border px-4 py-3 text-left transition ${
                        bodyImagePreset === preset.id
                          ? "border-[var(--color-accent)] bg-[var(--color-paper-muted)]"
                          : "border-[var(--color-line)] bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-[var(--color-ink)]">{preset.label}</span>
                        <span className="text-xs text-[var(--color-soft-ink)]">{preset.description}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <Button type="button" variant="outline" onClick={() => openFilePicker("content")} disabled={uploadingImage}>
                    <ImagePlus className="h-4 w-4" />
                    본문 업로드
                  </Button>
                  <Button
                    type="button"
                    variant="soft"
                    onClick={() => {
                      setUploadTarget("content");
                      setMediaSheetOpen(true);
                    }}
                  >
                    <Images className="h-4 w-4" />
                    라이브러리에서 삽입
                  </Button>
                </div>

                <div className="space-y-3">
                  {editableImages.length ? (
                    editableImages.map((image, index) => (
                      <button
                        key={`${image.src}-${index}`}
                        type="button"
                        onClick={() => setSelectedImageIndex(index)}
                        className={`flex w-full items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition ${
                          index === selectedImageIndex
                            ? "border-[var(--color-accent)] bg-[var(--color-paper-muted)]"
                            : "border-[var(--color-line)] bg-white"
                        }`}
                      >
                        <img src={image.src} alt={image.alt || "본문 이미지"} className="h-16 w-16 rounded-[14px] object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                            {image.alt || image.caption || image.src}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-soft-ink)]">
                            {index + 1}번째 이미지 · {image.width} · {image.align}
                          </p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-[var(--color-line)] bg-[var(--color-paper-muted)] px-4 py-5 text-sm text-[var(--color-soft-ink)]">
                      본문에 삽입된 이미지가 아직 없습니다.
                    </div>
                  )}
                </div>

                {selectedEditableImage ? (
                  <div className="space-y-3 rounded-[18px] border border-[var(--color-line)] bg-[var(--color-paper-muted)] p-4">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[var(--color-ink)]">이미지 ALT</span>
                      <Input value={selectedEditableImage.alt} onChange={(event) => handleImageMetaChange("alt", event.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[var(--color-ink)]">캡션</span>
                      <Textarea
                        value={selectedEditableImage.caption}
                        onChange={(event) => handleImageMetaChange("caption", event.target.value)}
                        rows={3}
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-[var(--color-ink)]">정렬</span>
                        <Select
                          value={selectedEditableImage.align}
                          onChange={(event) => handleImageMetaChange("align", event.target.value)}
                        >
                          <option value="left">왼쪽 플로트</option>
                          <option value="center">가운데</option>
                          <option value="full">넓게</option>
                        </Select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-[var(--color-ink)]">폭</span>
                        <Select
                          value={selectedEditableImage.width}
                          onChange={(event) => handleImageMetaChange("width", event.target.value)}
                        >
                          <option value="narrow">좁게</option>
                          <option value="default">기본</option>
                          <option value="wide">넓게</option>
                        </Select>
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[24px] border border-white/70 bg-white/78 p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-semibold tracking-tight text-[var(--color-ink)]">CTR / SEO 작성 보조</h2>
                <p className="mt-1 text-sm text-[var(--color-soft-ink)]">
                  제목/요약문/슬러그/태그 신호를 점검하고, 본문 템플릿으로 구조를 빠르게 채울 수 있습니다.
                </p>
              </div>
              <div className="space-y-4">
                <div className="rounded-[16px] border border-[var(--color-line)] bg-[var(--color-paper-muted)] p-4">
                  <div className="mb-2 flex items-center justify-between text-sm text-[var(--color-soft-ink)]">
                    <span>SEO 점수</span>
                    <span className="font-semibold" style={{ color: seoColor }}>
                      {seoChecks.score} / 100
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {seoChecks.details.map((item) => (
                      <li key={item.key} className="flex items-start gap-2 text-sm text-[var(--color-soft-ink)]">
                        {item.status === "good" ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                        ) : item.status === "warn" ? (
                          <CircleAlert className="mt-0.5 h-4 w-4 text-amber-600" />
                        ) : (
                          <CircleAlert className="mt-0.5 h-4 w-4 text-red-600" />
                        )}
                        <span>
                          <span className="font-medium text-[var(--color-ink)]">{item.label}</span>
                          <span className="ml-1.5">{item.message}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <Button type="button" variant="soft" onClick={applySlugFromTitle}>
                    <RefreshCw className="h-4 w-4" />
                    제목 기준 슬러그 생성
                  </Button>
                  <Button type="button" variant="outline" onClick={applySuggestedExcerpt}>
                    <Sparkles className="h-4 w-4" />
                    본문 기반 요약문 자동 채움
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const previewUrl = `${window.location.origin}/ko/post/${form.slug.trim()}`;
                      void navigator.clipboard?.writeText(previewUrl);
                    }}
                    disabled={!form.slug.trim()}
                  >
                    <Copy className="h-4 w-4" />
                    임시 미리보기 URL 복사
                  </Button>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-[var(--color-ink)]">작성 템플릿</label>
                  <div className="grid gap-2">
                    {WRITING_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => insertTemplate(template.markdown)}
                        className="rounded-[14px] border border-[var(--color-line)] bg-white px-4 py-3 text-left transition hover:bg-[var(--color-paper-muted)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-[var(--color-ink)]">{template.label}</span>
                          <span className="text-xs text-[var(--color-soft-ink)]">{template.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-[14px] border border-[var(--color-line)] bg-white p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                    <Blocks className="h-4 w-4" />
                    오픈소스 무료 편집기 적용 참고
                  </p>
                  <ul className="space-y-2 text-sm text-[var(--color-soft-ink)]">
                    {OPEN_SOURCE_EDITOR_TOOLS.map((tool) => (
                      <li key={tool.name}>
                        <strong className="text-[var(--color-ink)]">{tool.name}</strong> · {tool.note}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-white/70 bg-white/78 p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-[var(--color-ink)]">관련 링크 카드</h2>
                  <p className="mt-1 text-sm text-[var(--color-soft-ink)]">
                    본문 하단에만 노출됩니다. URL 미리 가져오기로 제목, 설명, 썸네일을 채울 수 있습니다.
                  </p>
                </div>
                <span className="text-xs font-medium text-[var(--color-soft-ink)]">
                  {form.relatedLinks.length}/{RELATED_LINK_LIMIT}
                </span>
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-[var(--color-soft-ink)]">
                    URL 행을 추가한 뒤 각 행에서 미리 가져오기를 실행합니다.
                  </p>
                  <Button type="button" variant="soft" onClick={addRelatedLinkRow} disabled={!canAddRelatedLink}>
                    <Plus className="h-4 w-4" />
                    링크 행 추가
                  </Button>
                </div>
                <div className="space-y-3">
                  {form.relatedLinks.length ? (
                    form.relatedLinks.map((link, index) => (
                      <div key={`${link.url}-${index}`} className="space-y-4 rounded-[18px] border border-[var(--color-line)] bg-[var(--color-paper-muted)] p-5">
                        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                          <Input
                            value={link.url}
                            onChange={(event) => updateRelatedLink(index, "url", event.target.value)}
                            placeholder="https://example.com/article"
                            className="min-w-0"
                          />
                          <Button
                            type="button"
                            variant="soft"
                            onClick={() => void handleRelatedLinkPreviewAt(index)}
                            disabled={!link.url?.trim() || fetchingRelatedLinkIndex === index}
                          >
                            <Link2 className="h-4 w-4" />
                            {fetchingRelatedLinkIndex === index ? "가져오는 중..." : "미리 가져오기"}
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => removeRelatedLink(index)}>
                            <Minus className="h-4 w-4" />
                            삭제
                          </Button>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-white">
                            {link.image ? (
                              <img
                                src={link.image}
                                alt={link.title || link.siteName || `관련 링크 ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-xs text-[var(--color-soft-ink)]">이미지 없음</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <Input
                              value={link.title ?? ""}
                              onChange={(event) => updateRelatedLink(index, "title", event.target.value)}
                              placeholder="카드 제목"
                            />
                            <Input
                              value={link.siteName ?? ""}
                              onChange={(event) => updateRelatedLink(index, "siteName", event.target.value)}
                              placeholder="출처 이름"
                            />
                            <Input
                              value={link.image ?? ""}
                              onChange={(event) => updateRelatedLink(index, "image", event.target.value)}
                              placeholder="썸네일 URL"
                            />
                            <Textarea
                              value={link.description ?? ""}
                              onChange={(event) => updateRelatedLink(index, "description", event.target.value)}
                              rows={4}
                              placeholder="카드 설명"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" onClick={() => moveRelatedLink(index, -1)} disabled={index === 0}>
                            <ArrowUp className="h-4 w-4" />
                            위로
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => moveRelatedLink(index, 1)}
                            disabled={index === form.relatedLinks.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                            아래로
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-[var(--color-line)] bg-[var(--color-paper-muted)] px-4 py-5 text-sm text-[var(--color-soft-ink)]">
                      관련 링크 카드가 아직 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-white/70 bg-white/78 p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-semibold tracking-tight text-[var(--color-ink)]">발행 / 카테고리 / 태그</h2>
                <p className="mt-1 text-sm text-[var(--color-soft-ink)]">
                  발행 상태와 분류 정보는 마지막에 여기서 확정합니다.
                </p>
              </div>
              <div className="space-y-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">상태</span>
                  <Select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PostStatus }))}
                  >
                    <option value="draft">초안</option>
                    <option value="published">발행</option>
                    <option value="archived">보관</option>
                  </Select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">발행일</span>
                  <Input
                    type="date"
                    value={form.publishedAt}
                    onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">카테고리</span>
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
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">태그</span>
                  <Textarea
                    value={form.tagNamesInput}
                    onChange={(event) => setForm((current) => ({ ...current, tagNamesInput: event.target.value }))}
                    rows={4}
                    placeholder="쉼표로 구분해 입력합니다. 예: 기록, 미스터리, 조사"
                  />
                </label>
                <div className="rounded-[18px] bg-[var(--color-paper-muted)] px-4 py-4 text-sm text-[var(--color-soft-ink)]">
                  현재 태그: {parseTagInputValue(form.tagNamesInput).length ? parseTagInputValue(form.tagNamesInput).join(", ") : "아직 없음"}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </ShellCard>

      <Sheet open={mediaSheetOpen} onOpenChange={setMediaSheetOpen}>
        <SheetContent className="max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{uploadTarget === "cover" ? "대표 이미지 선택" : "본문 이미지 선택"}</SheetTitle>
            <SheetDescription>업로드된 미디어에서 선택하면 현재 프리셋으로 바로 삽입합니다.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {media.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => handleSelectMediaAsset(asset)}
                className="overflow-hidden rounded-[20px] border border-[var(--color-line)] bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <img src={asset.url} alt={asset.altText || getMediaAssetLabel(asset)} className="aspect-[4/3] w-full object-cover" />
                <div className="space-y-1 px-4 py-4">
                  <p className="truncate text-sm font-medium text-[var(--color-ink)]">{getMediaAssetLabel(asset)}</p>
                  <p className="line-clamp-2 text-xs text-[var(--color-soft-ink)]">{asset.altText || "ALT 없음"}</p>
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </form>
  );
}

