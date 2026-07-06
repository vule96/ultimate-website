// Types dùng chung giữa các app FE, mirror API của Go core.

export type PostStatus = "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED";

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  content_json: unknown;
  content_html: string;
  excerpt: string | null;
  cover_image: string | null;
  status: PostStatus;
  meta_title: string | null;
  meta_desc: string | null;
  published_at: string | null;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface PostListResponse {
  data: Post[];
  page: number;
  page_size: number;
  total: number;
}

/** Admin đang đăng nhập (từ GET /auth/me). */
export interface AdminUser {
  email: string;
}

/** Envelope lỗi API: { error: { code, message } }. */
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
