import Image from "@tiptap/extension-image";

export const RichImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: "editor-image align-center",
      },
      title: {
        default: null,
      },
      width: {
        default: null,
      },
      "data-align": {
        default: "center",
      },
    };
  },
});
