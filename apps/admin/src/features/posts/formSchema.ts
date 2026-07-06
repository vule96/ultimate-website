import { z } from "zod";
import { PostStatusSchema, type Post, type UpsertPostInput } from "@ultimate/types";

/**
 * Schema cho form tạo/sửa bài viết. Mọi field là string (controlled input);
 * `tagsCsv` là chuỗi phân tách bởi dấu phẩy, `content` map sang content_html.
 * content_json để 3c (rich editor) đảm nhận.
 */
export const postFormSchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề là bắt buộc"),
  slug: z.string(),
  status: PostStatusSchema,
  tagsCsv: z.string(),
  excerpt: z.string(),
  content: z.string(),
  metaTitle: z.string(),
  metaDesc: z.string(),
});

export type PostFormValues = z.infer<typeof postFormSchema>;

/** Giá trị mặc định khi tạo bài mới. */
export const emptyPostForm: PostFormValues = {
  title: "",
  slug: "",
  status: "DRAFT",
  tagsCsv: "",
  excerpt: "",
  content: "",
  metaTitle: "",
  metaDesc: "",
};

/** Tách chuỗi CSV tags → mảng đã trim, bỏ rỗng. */
export function parseTagsCsv(csv: string): string[] {
  return csv
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Map giá trị form → payload gửi API. */
export function toUpsertInput(v: PostFormValues): UpsertPostInput {
  const slug = v.slug.trim();
  const excerpt = v.excerpt.trim();
  const metaTitle = v.metaTitle.trim();
  const metaDesc = v.metaDesc.trim();

  const input: UpsertPostInput = {
    title: v.title.trim(),
    content_html: v.content,
    content_json: {},
    status: v.status,
    excerpt: excerpt || null,
    meta_title: metaTitle || null,
    meta_desc: metaDesc || null,
    tags: parseTagsCsv(v.tagsCsv),
  };
  // slug tuỳ chọn: bỏ trống → server tự sinh từ tiêu đề.
  if (slug) input.slug = slug;
  return input;
}

/** Map Post đã load → giá trị prefill cho form sửa. */
export function postToFormValues(p: Post): PostFormValues {
  return {
    title: p.title,
    slug: p.slug,
    status: p.status,
    tagsCsv: p.tags.map((t) => t.name).join(", "),
    excerpt: p.excerpt ?? "",
    content: p.content_html,
    metaTitle: p.meta_title ?? "",
    metaDesc: p.meta_desc ?? "",
  };
}
