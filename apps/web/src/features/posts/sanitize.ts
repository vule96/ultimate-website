import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { defaultSchema, type Options } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

// Allowlist mở rộng cho output editor (Tiptap/Lexical): bảng, task-list, highlight, ảnh, code.
const schema: Options = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "mark",
    "figure",
    "figcaption",
    "input",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className"],
    a: [...(defaultSchema.attributes?.a ?? []), "rel", "target"],
    img: [...(defaultSchema.attributes?.img ?? []), "src", "alt", "title", "width", "height"],
    input: [["type", "checkbox"], "checked", "disabled"],
    th: [...(defaultSchema.attributes?.th ?? []), "colSpan", "rowSpan"],
    td: [...(defaultSchema.attributes?.td ?? []), "colSpan", "rowSpan"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https", "data"],
  },
};

const processor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeSanitize, schema)
  .use(rehypeStringify);

// sanitizeHtml lọc content_html qua allowlist (loại script/on*/javascript:) — defense-in-depth.
export async function sanitizeHtml(html: string): Promise<string> {
  const file = await processor.process(html);
  return String(file);
}
