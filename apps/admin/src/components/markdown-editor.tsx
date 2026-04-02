import type { EditorType } from "@toast-ui/editor";
import type ToastEditorCore from "@toast-ui/editor";
import { Editor } from "@toast-ui/react-editor";
import {
  type ChangeEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import "@toast-ui/editor/dist/toastui-editor.css";

type EditorMode = EditorType | "html";

export interface EditorImagePayload {
  url: string;
  altText?: string | null;
  caption?: string | null;
  width?: "narrow" | "default" | "wide";
  align?: "left" | "center" | "full";
}

export interface MarkdownEditorHandle {
  focus: () => void;
  insertImage: (payload: EditorImagePayload) => void;
  insertMarkdown: (text: string) => void;
  getValue: () => string;
  getMode: () => EditorMode;
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function insertTextAtSelection(textarea: HTMLTextAreaElement, nextText: string) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  return `${textarea.value.slice(0, start)}${nextText}${textarea.value.slice(end)}`;
}

function looksLikeHtmlContent(value: string) {
  return /<[a-z][\s\S]*>/i.test(value);
}

function normalizeFigureAlign(align?: EditorImagePayload["align"]) {
  if (align === "left" || align === "center" || align === "full") {
    return align;
  }

  return "left";
}

function normalizeFigureWidth(width?: EditorImagePayload["width"]) {
  if (width === "narrow" || width === "default" || width === "wide") {
    return width;
  }

  return "default";
}

export function buildImageMarkdown(url: string, altText?: string | null) {
  return buildImageHtml(url, { altText });
}

export function buildImageHtml(
  url: string,
  options?: Pick<EditorImagePayload, "altText" | "caption" | "width" | "align">,
) {
  const safeAlt = escapeHtmlAttribute((options?.altText ?? "").replace(/[\r\n]+/g, " ").trim());
  const safeCaption = (options?.caption ?? "").trim();
  const safeUrl = escapeHtmlAttribute(url);
  const align = normalizeFigureAlign(options?.align);
  const width = normalizeFigureWidth(options?.width);
  const captionMarkup = safeCaption
    ? `\n  <figcaption>${safeCaption
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</figcaption>`
    : "";

  return `<figure data-media-block="true" data-align="${align}" data-width="${width}">\n  <img src="${safeUrl}" alt="${safeAlt}" loading="lazy" />${captionMarkup}\n</figure>`;
}

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    onUploadImage?: (file: File) => Promise<{ url: string; altText?: string | null }>;
    onError?: (message: string) => void;
  }
>(function MarkdownEditor(props, ref) {
  const editorRef = useRef<Editor>(null);
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<EditorMode>("wysiwyg");
  const [htmlValue, setHtmlValue] = useState("");
  const suppressChangeRef = useRef(false);

  const toolbarItems = useMemo(
    () => [
      ["heading", "bold", "italic", "strike"],
      ["hr", "quote"],
      ["ul", "ol", "task"],
      ["table", "link", "image"],
      ["code", "codeblock"],
    ],
    [],
  );

  const getInstance = () => editorRef.current?.getInstance() as ToastEditorCore | undefined;

  const syncParentFromEditor = () => {
    const instance = getInstance();

    if (!instance) {
      return;
    }

    props.onChange(instance.getMarkdown());
  };

  const applyContentToEditor = (value: string) => {
    const instance = getInstance();

    if (!instance) {
      return;
    }

    suppressChangeRef.current = true;

    if (looksLikeHtmlContent(value) && !instance.isMarkdownMode()) {
      instance.setHTML(value || "", false);
    } else {
      instance.setMarkdown(value || "", false);
    }

    suppressChangeRef.current = false;
  };

  const changeMode = (nextMode: EditorMode) => {
    const instance = getInstance();

    if (!instance) {
      setMode(nextMode);
      return;
    }

    if (nextMode === "html") {
      setHtmlValue(instance.getHTML());
      setMode("html");
      return;
    }

    suppressChangeRef.current = true;

    if (mode === "html") {
      instance.setHTML(htmlValue || "", false);
    }

    instance.changeMode(nextMode, true);
    suppressChangeRef.current = false;
    setMode(nextMode);
    syncParentFromEditor();
  };

  const insertImage = (payload: EditorImagePayload) => {
    const imageMarkdown = buildImageHtml(payload.url, payload);
    const instance = getInstance();

    if (!instance) {
      return;
    }

    if (mode === "html") {
      const textarea = htmlTextareaRef.current;
      const nextValue = textarea ? insertTextAtSelection(textarea, `\n${imageMarkdown}\n`) : `${htmlValue}\n${imageMarkdown}\n`;
      setHtmlValue(nextValue);
      props.onChange(nextValue);
      return;
    }

    if (instance.isMarkdownMode()) {
      instance.replaceSelection(imageMarkdown);
      syncParentFromEditor();
      return;
    }

    suppressChangeRef.current = true;
    instance.changeMode("markdown", true);
    instance.replaceSelection(imageMarkdown);
    const updatedMarkdown = instance.getMarkdown();
    instance.changeMode("wysiwyg", true);
    suppressChangeRef.current = false;
    props.onChange(updatedMarkdown);
  };

  const insertMarkdown = (text: string) => {
    const instance = getInstance();

    if (!instance) {
      return;
    }

    if (mode === "html") {
      const textarea = htmlTextareaRef.current;
      const nextValue = textarea ? insertTextAtSelection(textarea, `\n${text}\n`) : `${htmlValue}\n${text}\n`;
      setHtmlValue(nextValue);
      props.onChange(nextValue);
      return;
    }

    if (instance.isMarkdownMode()) {
      instance.replaceSelection(text);
      syncParentFromEditor();
      return;
    }

    suppressChangeRef.current = true;
    instance.changeMode("markdown", true);
    instance.replaceSelection(text);
    const updatedMarkdown = instance.getMarkdown();
    instance.changeMode("wysiwyg", true);
    suppressChangeRef.current = false;
    props.onChange(updatedMarkdown);
  };

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        if (mode === "html") {
          htmlTextareaRef.current?.focus();
          return;
        }

        getInstance()?.focus();
      },
      insertImage,
      insertMarkdown,
      getValue() {
        return mode === "html" ? htmlValue : getInstance()?.getMarkdown() ?? "";
      },
      getMode() {
        return mode;
      },
    }),
    [htmlValue, mode],
  );

  useEffect(() => {
    if (mode === "html") {
      if (props.value !== htmlValue) {
        setHtmlValue(props.value);
      }

      return;
    }

    const instance = getInstance();

    if (!instance) {
      return;
    }

    const currentValue = instance.getMarkdown();

    if (currentValue !== props.value) {
      applyContentToEditor(props.value);
    }
  }, [htmlValue, mode, props.value]);

  const handleChange = () => {
    if (suppressChangeRef.current || mode === "html") {
      return;
    }

    syncParentFromEditor();
  };

  const handleHtmlChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setHtmlValue(nextValue);
    props.onChange(nextValue);
  };

  const handleUploadImage = async (blob: Blob | File, callback: (url: string, text?: string) => void) => {
    if (!(blob instanceof File) || !props.onUploadImage) {
      props.onError?.("Image uploads are not available in this editor.");
      return;
    }

    try {
      const asset = await props.onUploadImage(blob);
      callback(asset.url, asset.altText ?? blob.name);
    } catch (error) {
      props.onError?.(error instanceof Error ? error.message : "Image upload failed.");
    }
  };

  return (
    <div className="markdown-editor-shell" data-color-mode="light">
      <div className="editor-mode-tabs" role="tablist" aria-label="Content editor mode">
        {([
          ["wysiwyg", "WYSIWYG"],
          ["markdown", "Markdown"],
          ["html", "HTML"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="editor-mode-tab"
            data-active={mode === value}
            onClick={() => changeMode(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "html" ? (
        <textarea
          ref={htmlTextareaRef}
          className="editor-html-source"
          value={htmlValue}
          onChange={handleHtmlChange}
          placeholder={'<figure><img src="..." alt="..." /></figure>'}
        />
      ) : (
        <Editor
          ref={editorRef}
          initialValue={props.value}
          initialEditType={"wysiwyg" satisfies EditorType}
          previewStyle="vertical"
          height="620px"
          hideModeSwitch
          usageStatistics={false}
          autofocus={false}
          placeholder={props.placeholder}
          toolbarItems={toolbarItems}
          hooks={{
            addImageBlobHook: handleUploadImage,
          }}
          onChange={handleChange}
        />
      )}
    </div>
  );
});
