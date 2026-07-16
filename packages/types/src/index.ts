// Types dùng chung giữa các app FE — Zod là single source of truth:
// định nghĩa schema 1 lần → suy ra type (z.infer) + validate runtime.
import { z } from "zod";
import type { SetOptional } from "type-fest";

/** Trạng thái vòng đời bài viết. */
export const PostStatusSchema = z.enum(["DRAFT", "PENDING_APPROVAL", "PUBLISHED"]);
export type PostStatus = z.infer<typeof PostStatusSchema>;

/** Branded ID: PostId và TagId không thể lẫn lộn dù đều là string. */
export const PostIdSchema = z.string().uuid().brand<"PostId">();
export type PostId = z.infer<typeof PostIdSchema>;

export const TagIdSchema = z.string().uuid().brand<"TagId">();
export type TagId = z.infer<typeof TagIdSchema>;

export const TagSchema = z.object({
  id: TagIdSchema,
  name: z.string(),
  slug: z.string(),
});
export type Tag = z.infer<typeof TagSchema>;

export const PostSchema = z.object({
  id: PostIdSchema,
  title: z.string(),
  slug: z.string(),
  content_json: z.unknown(),
  content_html: z.string(),
  excerpt: z.string().nullable(),
  cover_image: z.string().nullable(),
  /** Blurhash của cover — worker nền core tính (Slice 9); null khi chưa có. */
  cover_blurhash: z.string().nullable(),
  status: PostStatusSchema,
  meta_title: z.string().nullable(),
  meta_desc: z.string().nullable(),
  published_at: z.string().nullable(),
  version: z.number().int(),
  /** Lượt xem cộng dồn bởi view counter batch (Slice 9). */
  views: z.number().int(),
  tags: z.array(TagSchema),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Post = z.infer<typeof PostSchema>;

export const PostListResponseSchema = z.object({
  data: z.array(PostSchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
});
export type PostListResponse = z.infer<typeof PostListResponseSchema>;

/** Danh sách tag (GET /tags) — bọc trong { data }. */
export const TagListResponseSchema = z.object({ data: z.array(TagSchema) });
export type TagListResponse = z.infer<typeof TagListResponseSchema>;

/** Số liệu tổng hợp bài viết cho Dashboard (GET /stats/posts). */
export const PostStatsSchema = z.object({
  total: z.number().int(),
  published: z.number().int(),
  draft: z.number().int(),
  tags: z.number().int(),
});
export type PostStats = z.infer<typeof PostStatsSchema>;

/** Một điểm dữ liệu chart theo tháng (GET /stats/posts/timeseries). */
export const PostTimeseriesSchema = z.array(
  z.object({ month: z.string(), count: z.number().int() }),
);
export type PostTimeseries = z.infer<typeof PostTimeseriesSchema>;

/** Cột được phép sắp xếp cho danh sách bài viết (khớp whitelist ở core). */
export const PostSortFieldSchema = z.enum(["title", "status", "updated_at", "created_at"]);
export type PostSortField = z.infer<typeof PostSortFieldSchema>;

export const SortOrderSchema = z.enum(["asc", "desc"]);
export type SortOrder = z.infer<typeof SortOrderSchema>;

/** Kết quả xin presigned URL upload ảnh (POST /media/presign). */
export const PresignResponseSchema = z.object({
  upload_url: z.string(),
  public_url: z.string(),
  key: z.string(),
  expires_in: z.number().int(),
});
export type PresignResponse = z.infer<typeof PresignResponseSchema>;

/** Admin đang đăng nhập (GET /auth/me). */
export const AdminUserSchema = z.object({ email: z.string() });
export type AdminUser = z.infer<typeof AdminUserSchema>;

/**
 * Input tạo/sửa bài viết gửi lên API. Dùng type-fest SetOptional để đánh dấu
 * các field có thể bỏ trống (server tự sinh slug, các field SEO là tuỳ chọn).
 */
export type UpsertPostInput = SetOptional<
  {
    title: string;
    slug: string;
    content_json: unknown;
    content_html: string;
    excerpt: string | null;
    cover_image: string | null;
    status: PostStatus;
    meta_title: string | null;
    meta_desc: string | null;
    tags: string[];
    /** Optimistic locking (M5): bắt buộc khi update; create bỏ qua. */
    version: number;
  },
  | "slug"
  | "excerpt"
  | "cover_image"
  | "status"
  | "meta_title"
  | "meta_desc"
  | "content_json"
  | "version"
>;

/** Envelope lỗi API: { error: { code, message } }. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
