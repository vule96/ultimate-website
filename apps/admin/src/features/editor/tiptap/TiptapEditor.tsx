import { useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Link2,
  ImageIcon,
  Minus,
  Highlighter,
  ListChecks,
  Table as TableIcon,
} from "lucide-react";
import type { PostEditorProps } from "../types";
import { ToolbarButton, ToolbarDivider } from "../ToolbarButton";
import "../editor.css";

export default function TiptapEditor({ initialHtml, onChange, uploadImage }: PostEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialHtml || "",
    editorProps: { attributes: { class: "rich-content" } },
    onUpdate: ({ editor }) => onChange({ html: editor.getHTML(), json: editor.getJSON() }),
  });

  if (!editor) return null;

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại cùng file
    if (!file || !editor) return;
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      // lỗi upload đã được uploadImage ném ra; toast xử lý ở tầng gọi nếu cần
    }
  }

  return (
    <div className="rounded-md border border-border bg-background">
      <Toolbar editor={editor} onImageClick={() => fileRef.current?.click()} />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onPickImage}
      />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, onImageClick }: { editor: Editor; onImageClick: () => void }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").url as string | undefined;
    const url = window.prompt("Nhập URL liên kết:", prev ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1.5">
      <ToolbarButton icon={Bold} label="Đậm" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolbarButton icon={Italic} label="Nghiêng" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolbarButton icon={Highlighter} label="Tô sáng" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} />
      <ToolbarDivider />
      <ToolbarButton icon={Heading2} label="Tiêu đề 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <ToolbarButton icon={Heading3} label="Tiêu đề 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      <ToolbarDivider />
      <ToolbarButton icon={List} label="Danh sách" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolbarButton icon={ListOrdered} label="Danh sách số" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <ToolbarButton icon={ListChecks} label="Danh sách việc" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} />
      <ToolbarDivider />
      <ToolbarButton icon={Quote} label="Trích dẫn" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <ToolbarButton icon={Code2} label="Khối code" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
      <ToolbarButton icon={Minus} label="Đường kẻ" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      <ToolbarDivider />
      <ToolbarButton icon={Link2} label="Liên kết" active={editor.isActive("link")} onClick={setLink} />
      <ToolbarButton icon={ImageIcon} label="Chèn ảnh" onClick={onImageClick} />
      <ToolbarButton icon={TableIcon} label="Chèn bảng" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
    </div>
  );
}
