declare module "@toast-ui/editor" {
  export type EditorType = "markdown" | "wysiwyg";
  export type EditorPos = number | [number, number];

  export default class Editor {
    focus(): void;
    getMarkdown(): string;
    setMarkdown(markdown: string, cursorToEnd?: boolean): void;
    getHTML(): string;
    setHTML(html: string, cursorToEnd?: boolean): void;
    insertText(text: string): void;
    replaceSelection(text: string, start?: EditorPos, end?: EditorPos): void;
    isMarkdownMode(): boolean;
    isWysiwygMode(): boolean;
    changeMode(mode: EditorType, isWithoutFocus?: boolean): void;
  }
}
