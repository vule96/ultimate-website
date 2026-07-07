import { lazy, Suspense } from "react";
import { EDITOR_KIND } from "./config";
import type { PostEditorProps } from "./types";

// Code-split: chỉ tải editor được chọn (Tiptap/Lexical đều nặng).
const TiptapEditor = lazy(() => import("./tiptap/TiptapEditor"));
const LexicalEditor = lazy(() => import("./lexical/LexicalEditor"));

/**
 * Chọn editor theo flag VITE_EDITOR. Cả hai cùng interface PostEditorProps nên
 * PostFormPage không phụ thuộc thư viện cụ thể.
 */
export function EditorSwitch(props: PostEditorProps) {
  const Editor = EDITOR_KIND === "lexical" ? LexicalEditor : TiptapEditor;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[20rem] items-center justify-center rounded-md border border-border text-sm text-muted-foreground">
          Đang tải trình soạn thảo…
        </div>
      }
    >
      <Editor {...props} />
    </Suspense>
  );
}
