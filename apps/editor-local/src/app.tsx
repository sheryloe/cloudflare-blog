import Dropcursor from "@tiptap/extension-dropcursor";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { Copy, Languages, Save, Sparkles, Upload } from "lucide-react";
import { useMemo, useState } from "react";

import {
  buildEmptyDraft,
  exportMdx,
  loadDraft,
  parseTagInput,
  saveAsset,
  saveDraft,
  scoreDocument,
  translateDocument,
  type DraftDocument,
} from "./lib/api";
import { RichImage } from "./lib/rich-image";
import { slugify } from "@cloudflare-blog/shared-utils";

function copyText(value: string) {
  return navigator.clipboard.writeText(value);
}

export function App() {
  const [draft, setDraft] = useState<DraftDocument>(() => buildEmptyDraft());
  const [tagInput, setTagInput] = useState("");
  const [activePreview, setActivePreview] = useState<"html" | "mdx" | "frontmatter" | "diff">("html");
  const [sourceMode, setSourceMode] = useState<"visual" | "html">("visual");
  const [htmlSource, setHtmlSource] = useState(draft.bodyHtml);
  const [selectedImageAttrs, setSelectedImageAttrs] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [draftIdInput, setDraftIdInput] = useState("");

  const editor = useEditor({
    extensions: [StarterKit, Dropcursor, RichImage],
    content: draft.bodyHtml,
    editorProps: {
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []);
        const imageFile = files.find((file) => file.type.startsWith("image/"));

        if (!imageFile) {
          return false;
        }

        event.preventDefault();
        const fallbackSlug = slugify(draft.slug || draft.title || "local-draft") || "local-draft";

        void saveAsset(imageFile, fallbackSlug, imageFile.name.replace(/\.[^.]+$/, ""))
          .then((asset) => {
            setDraft((current) => ({
              ...current,
              slug: current.slug || fallbackSlug,
              assets: [...current.assets, asset],
            }));
            const position = view.posAtCoords({ left: event.clientX, top: event.clientY });

            if (position) {
              editor?.chain().focus().setTextSelection(position.pos).setImage({ src: asset.url, alt: asset.altText }).run();
            } else {
              editor?.chain().focus().setImage({ src: asset.url, alt: asset.altText }).run();
            }
          })
          .catch((reason) => setStatusMessage(reason instanceof Error ? reason.message : "Failed to save the dropped image."));

        return true;
      },
    },
    onUpdate({ editor: currentEditor }) {
      const nextHtml = currentEditor.getHTML();
      setHtmlSource(nextHtml);
      setDraft((current) => ({
        ...current,
        slug: current.slug || slugify(current.title) || "",
        bodyHtml: nextHtml,
        updatedAt: new Date().toISOString(),
      }));
      setSelectedImageAttrs(currentEditor.isActive("image") ? currentEditor.getAttributes("image") : {});
    },
    onSelectionUpdate({ editor: currentEditor }) {
      setSelectedImageAttrs(currentEditor.isActive("image") ? currentEditor.getAttributes("image") : {});
    },
  });

  const frontmatterPreview = useMemo(
    () => ({
      title: draft.title,
      description: draft.description,
      lang: draft.sourceLang,
      slug: draft.slug,
      groupId: draft.groupId,
      translationOf: null,
      publishedAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
      draft: false,
      coverImage: draft.coverImage || "/images/posts/example/cover.webp",
      coverAlt: draft.coverAlt || draft.title,
      tags: draft.tags,
      category: draft.category,
      canonicalLang: draft.sourceLang,
      ogImage: draft.coverImage || "/images/posts/example/cover.webp",
    }),
    [draft],
  );

  const selectedTranslation = draft.sourceLang === "ko" ? draft.translated.en : draft.translated.ko;

  const mdxPreview = useMemo(() => {
    const lines = [
      "---",
      `title: "${frontmatterPreview.title}"`,
      `description: "${frontmatterPreview.description}"`,
      `lang: "${frontmatterPreview.lang}"`,
      `slug: "${frontmatterPreview.slug}"`,
      `groupId: "${frontmatterPreview.groupId}"`,
      `translationOf: ${frontmatterPreview.translationOf ? `"${frontmatterPreview.translationOf}"` : "null"}`,
      `publishedAt: "${frontmatterPreview.publishedAt}"`,
      `updatedAt: "${frontmatterPreview.updatedAt}"`,
      `draft: ${frontmatterPreview.draft}`,
      `coverImage: "${frontmatterPreview.coverImage}"`,
      `coverAlt: "${frontmatterPreview.coverAlt}"`,
      `tags: [${frontmatterPreview.tags.map((tag) => `"${tag}"`).join(", ")}]`,
      `category: "${frontmatterPreview.category}"`,
      `canonicalLang: "${frontmatterPreview.canonicalLang}"`,
      `ogImage: "${frontmatterPreview.ogImage}"`,
      "---",
      "",
      draft.bodyHtml,
    ];

    return lines.join("\n");
  }, [draft.bodyHtml, frontmatterPreview]);

  const diffPreview = [draft.bodyHtml, selectedTranslation?.html ?? ""].join("\n\n-----\n\n");

  const handleSaveDraft = async () => {
    const nextDraft = {
      ...draft,
      tags: parseTagInput(tagInput),
      updatedAt: new Date().toISOString(),
    };
    setDraft(nextDraft);
    await saveDraft(nextDraft);
    setStatusMessage(`Draft saved: ${nextDraft.id}`);
  };

  const handleLoadDraft = async () => {
    const loaded = await loadDraft(draftIdInput || draft.id);
    setDraft(loaded);
    setTagInput(loaded.tags.join(", "));
    setHtmlSource(loaded.bodyHtml);
    editor?.commands.setContent(loaded.bodyHtml);
    setStatusMessage(`Draft loaded: ${loaded.id}`);
  };

  const handleTranslate = async () => {
    const targetLang = draft.sourceLang === "ko" ? "en" : "ko";
    const translated = await translateDocument({
      html: draft.bodyHtml,
      title: draft.title,
      description: draft.description,
      sourceLang: draft.sourceLang,
      targetLang,
    });

    setDraft((current) => ({
      ...current,
      translated: {
        ...current.translated,
        [current.sourceLang]: {
          lang: current.sourceLang,
          html: current.bodyHtml,
          title: current.title,
          description: current.description,
          warnings: [],
        },
        [targetLang]: translated,
      },
    }));
    setStatusMessage(`${targetLang.toUpperCase()} translation completed.`);
  };

  const handleScore = async () => {
    const translation = draft.sourceLang === "ko" ? draft.translated.en : draft.translated.ko;

    if (!translation) {
      setStatusMessage("Create a translation before scoring the document.");
      return;
    }

    const score = await scoreDocument({
      sourceHtml: draft.bodyHtml,
      translatedHtml: translation.html,
      title: draft.title,
      description: draft.description,
      tags: parseTagInput(tagInput),
      category: draft.category,
    });

    setDraft((current) => ({ ...current, score }));
    setStatusMessage(`Publish-readiness score calculated: ${score.total}.`);
  };

  const handleCopyMdx = async (lang: "ko" | "en") => {
    const html = lang === draft.sourceLang ? draft.bodyHtml : draft.translated[lang]?.html;

    if (!html) {
      setStatusMessage(`No ${lang.toUpperCase()} content is available yet.`);
      return;
    }

    const slug = draft.slug || slugify(draft.title) || "local-draft";
    const mdx = await exportMdx({
      lang,
      title: lang === draft.sourceLang ? draft.title : draft.translated[lang]?.title || draft.title,
      description:
        lang === draft.sourceLang ? draft.description : draft.translated[lang]?.description || draft.description,
      slug,
      groupId: draft.groupId,
      translationOf: lang === draft.sourceLang ? null : slug,
      publishedAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
      draft: false,
      coverImage: draft.coverImage || `/images/posts/${slug}/cover.webp`,
      coverAlt: draft.coverAlt || draft.title,
      tags: parseTagInput(tagInput),
      category: draft.category,
      canonicalLang: draft.sourceLang,
      ogImage: draft.coverImage || `/images/posts/${slug}/cover.webp`,
      html,
    });

    await copyText(mdx.mdx);
    setStatusMessage(`${lang.toUpperCase()} MDX copied to the clipboard.`);
  };

  const updateImageAttr = (key: string, value: string) => {
    editor?.chain().focus().updateAttributes("image", { [key]: value }).run();
    setSelectedImageAttrs((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="editor-app">
      <header className="editor-app__header">
        <div>
          <p className="eyebrow">Local-only editor</p>
          <h1>Local publishing workspace</h1>
          <p>
            Write, translate, score, export HTML or MDX, and save image assets locally before you copy the final post into the blog app.
          </p>
        </div>
        <div className="editor-app__actions">
          <button type="button" onClick={handleSaveDraft}>
            <Save size={16} />
            Save draft
          </button>
          <button type="button" onClick={handleLoadDraft}>
            <Upload size={16} />
            Load draft
          </button>
        </div>
      </header>

      <div className="editor-shell">
        <section className="editor-shell__left">
          <label>
            Title
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                  slug: current.slug || slugify(event.target.value) || "",
                }))
              }
            />
          </label>
          <label>
            Slug
            <input value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <label>
            Tags
            <input
              value={tagInput}
              placeholder="astro, workflow, editor"
              onChange={(event) => {
                setTagInput(event.target.value);
                setDraft((current) => ({ ...current, tags: parseTagInput(event.target.value) }));
              }}
            />
          </label>
          <label>
            Category
            <input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} />
          </label>
          <label>
            Draft ID
            <input value={draftIdInput} onChange={(event) => setDraftIdInput(event.target.value)} placeholder={draft.id} />
          </label>

          <div className="editor-panel">
            <div className="editor-panel__toolbar">
              <div className="editor-panel__tabs">
                <button type="button" data-active={sourceMode === "visual"} onClick={() => setSourceMode("visual")}>
                  Visual
                </button>
                <button type="button" data-active={sourceMode === "html"} onClick={() => setSourceMode("html")}>
                  HTML
                </button>
              </div>
              <button type="button" onClick={() => editor?.chain().focus().setParagraph().run()}>
                Paragraph
              </button>
            </div>

            {sourceMode === "visual" ? (
              <EditorContent editor={editor} className="editor-panel__content" />
            ) : (
              <textarea
                className="editor-panel__html"
                value={htmlSource}
                onChange={(event) => {
                  setHtmlSource(event.target.value);
                  setDraft((current) => ({ ...current, bodyHtml: event.target.value }));
                }}
                onBlur={() => {
                  editor?.commands.setContent(htmlSource);
                }}
              />
            )}
          </div>

          {editor?.isActive("image") ? (
            <div className="inspector-card">
              <p className="eyebrow">Image inspector</p>
              <label>
                Alt
                <input value={selectedImageAttrs.alt ?? ""} onChange={(event) => updateImageAttr("alt", event.target.value)} />
              </label>
              <label>
                Caption
                <input
                  value={selectedImageAttrs.title ?? ""}
                  onChange={(event) => updateImageAttr("title", event.target.value)}
                />
              </label>
              <label>
                Width
                <input
                  value={selectedImageAttrs.width ?? ""}
                  onChange={(event) => updateImageAttr("width", event.target.value)}
                />
              </label>
              <label>
                Align
                <select
                  value={selectedImageAttrs["data-align"] ?? "center"}
                  onChange={(event) => updateImageAttr("data-align", event.target.value)}
                >
                  <option value="left">left</option>
                  <option value="center">center</option>
                  <option value="full">full</option>
                </select>
              </label>
            </div>
          ) : null}
        </section>

        <aside className="editor-shell__right">
          <section className="side-card">
            <p className="eyebrow">Translation and score</p>
            <div className="side-card__actions">
              <button type="button" onClick={handleTranslate}>
                <Languages size={16} />
                Translate
              </button>
              <button type="button" onClick={handleScore}>
                <Sparkles size={16} />
                Score
              </button>
            </div>
            <div className="status-badge">{draft.score ? `${draft.score.total} / ${draft.score.status}` : "No score yet"}</div>
            <div className="warning-list">
              {(draft.score?.warnings ?? selectedTranslation?.warnings ?? []).map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </section>

          <section className="side-card">
            <p className="eyebrow">Assets</p>
            <div className="asset-list">
              {draft.assets.length ? (
                draft.assets.map((asset) => (
                  <div key={asset.id} className="asset-list__item">
                    <img src={asset.url} alt={asset.altText} />
                    <div>
                      <strong>{asset.altText}</strong>
                      <span>{asset.path}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p>Drag an image into the editor and it will be inserted at the drop position.</p>
              )}
            </div>
          </section>

          <section className="side-card">
            <p className="eyebrow">Copy output</p>
            <div className="side-card__actions side-card__actions--stack">
              <button type="button" onClick={() => copyText(draft.bodyHtml)}>
                <Copy size={16} />
                Copy HTML
              </button>
              <button type="button" onClick={() => handleCopyMdx("ko")}>
                <Copy size={16} />
                Copy MDX (KO)
              </button>
              <button type="button" onClick={() => handleCopyMdx("en")}>
                <Copy size={16} />
                Copy MDX (EN)
              </button>
              <button type="button" onClick={() => copyText(JSON.stringify(frontmatterPreview, null, 2))}>
                <Copy size={16} />
                Copy Frontmatter
              </button>
            </div>
          </section>
        </aside>
      </div>

      <section className="preview-shell">
        <div className="preview-tabs">
          {(["html", "mdx", "frontmatter", "diff"] as const).map((tab) => (
            <button key={tab} type="button" data-active={activePreview === tab} onClick={() => setActivePreview(tab)}>
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="preview-panel">
          {activePreview === "html" ? (
            <div dangerouslySetInnerHTML={{ __html: draft.bodyHtml }} />
          ) : activePreview === "mdx" ? (
            <pre>{mdxPreview}</pre>
          ) : activePreview === "frontmatter" ? (
            <pre>{JSON.stringify(frontmatterPreview, null, 2)}</pre>
          ) : (
            <pre>{diffPreview}</pre>
          )}
        </div>
      </section>

      {statusMessage ? <div className="status-toast">{statusMessage}</div> : null}
    </div>
  );
}
