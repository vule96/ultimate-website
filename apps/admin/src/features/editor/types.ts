/** Interface chung cho mọi rich editor (Tiptap / Lexical). */
export interface PostEditorProps {
  /** HTML khởi tạo (nguồn nạp chung — cầu nối giữa 2 editor). */
  initialHtml: string;
  /** Phát khi nội dung đổi: html (hiển thị/SEO) + json native (best-effort). */
  onChange: (v: { html: string; json: unknown }) => void;
  /** Upload ảnh, trả public URL để chèn vào nội dung. */
  uploadImage: (file: File) => Promise<string>;
}
