import { useEffect, useRef } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import {
  HorizontalRuleNode,
  INSERT_HORIZONTAL_RULE_COMMAND,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode, INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_CHECK_LIST_COMMAND } from "@lexical/list";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { CodeNode, CodeHighlightNode, $createCodeNode } from "@lexical/code";
import { TableNode, TableCellNode, TableRowNode, INSERT_TABLE_COMMAND } from "@lexical/table";
import { $setBlocksType } from "@lexical/selection";
import { $generateNodesFromDOM, $generateHtmlFromNodes } from "@lexical/html";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $insertNodes,
  FORMAT_TEXT_COMMAND,
} from "lexical";
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
import { ImageNode, $createImageNode } from "./ImageNode";
import "../editor.css";

const theme = {
  text: {
    bold: "font-bold",
    italic: "italic",
    highlight: "editor-hl",
  },
};

export default function LexicalEditor({ initialHtml, onChange, uploadImage }: PostEditorProps) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: "post-editor",
        theme,
        onError: (e) => console.error(e),
        nodes: [
          HeadingNode,
          QuoteNode,
          ListNode,
          ListItemNode,
          LinkNode,
          CodeNode,
          CodeHighlightNode,
          TableNode,
          TableCellNode,
          TableRowNode,
          HorizontalRuleNode,
          ImageNode,
        ],
      }}
    >
      <div className="rounded-md border border-border bg-background">
        <Toolbar uploadImage={uploadImage} />
        <RichTextPlugin
          contentEditable={<ContentEditable className="rich-content" />}
          placeholder={<div className="editor-placeholder px-4 pt-4">Nội dung…</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <LinkPlugin />
        <TablePlugin />
        <InitHtmlPlugin html={initialHtml} />
        <OnChangePlugin
          onChange={(editorState, editor) => {
            editorState.read(() => {
              const html = $generateHtmlFromNodes(editor, null);
              onChange({ html, json: editorState.toJSON() });
            });
          }}
        />
      </div>
    </LexicalComposer>
  );
}

/** Nạp initialHtml một lần khi mount (HTML là cầu nối nội dung). */
function InitHtmlPlugin({ html }: { html: string }) {
  const [editor] = useLexicalComposerContext();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (!html) return;
    editor.update(() => {
      const dom = new DOMParser().parseFromString(html, "text/html");
      const nodes = $generateNodesFromDOM(editor, dom);
      const root = $getRoot();
      root.clear();
      root.append(...nodes);
    });
  }, [editor, html]);
  return null;
}

function Toolbar({ uploadImage }: { uploadImage: (file: File) => Promise<string> }) {
  const [editor] = useLexicalComposerContext();
  const fileRef = useRef<HTMLInputElement>(null);

  const format = (fn: () => void) => () => editor.update(fn);

  const toHeading = (tag: "h2" | "h3") =>
    format(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createHeadingNode(tag));
    });

  const toQuote = format(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createQuoteNode());
  });

  const toCode = format(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createCodeNode());
  });

  const setLink = () => {
    const url = window.prompt("Nhập URL liên kết:", "https://");
    if (url === null) return;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url === "" ? null : url);
  };

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await uploadImage(file);
      editor.update(() => {
        $insertNodes([$createImageNode(url)]);
      });
    } catch {
      // uploadImage đã ném lỗi; xử lý toast ở tầng gọi nếu cần
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1.5">
      <ToolbarButton icon={Bold} label="Đậm" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} />
      <ToolbarButton icon={Italic} label="Nghiêng" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} />
      <ToolbarButton icon={Highlighter} label="Tô sáng" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "highlight")} />
      <ToolbarDivider />
      <ToolbarButton icon={Heading2} label="Tiêu đề 2" onClick={toHeading("h2")} />
      <ToolbarButton icon={Heading3} label="Tiêu đề 3" onClick={toHeading("h3")} />
      <ToolbarDivider />
      <ToolbarButton icon={List} label="Danh sách" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)} />
      <ToolbarButton icon={ListOrdered} label="Danh sách số" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} />
      <ToolbarButton icon={ListChecks} label="Danh sách việc" onClick={() => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)} />
      <ToolbarDivider />
      <ToolbarButton icon={Quote} label="Trích dẫn" onClick={toQuote} />
      <ToolbarButton icon={Code2} label="Khối code" onClick={toCode} />
      <ToolbarButton icon={Minus} label="Đường kẻ" onClick={() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)} />
      <ToolbarDivider />
      <ToolbarButton icon={Link2} label="Liên kết" onClick={setLink} />
      <ToolbarButton icon={ImageIcon} label="Chèn ảnh" onClick={() => fileRef.current?.click()} />
      <ToolbarButton icon={TableIcon} label="Chèn bảng" onClick={() => editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: "3", rows: "3" })} />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onPickImage}
      />
    </div>
  );
}
