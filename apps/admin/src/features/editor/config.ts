/** Loại editor được hỗ trợ. */
export type EditorKind = "tiptap" | "lexical";

/**
 * Editor đang dùng, chọn qua VITE_EDITOR lúc build (mặc định tiptap).
 * Cả 2 impl cùng interface PostEditorProps nên đổi flag là drop-in.
 */
export const EDITOR_KIND: EditorKind =
  import.meta.env.VITE_EDITOR === "lexical" ? "lexical" : "tiptap";
