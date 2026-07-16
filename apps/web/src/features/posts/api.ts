import {
  PostSchema,
  PostListResponseSchema,
  TagListResponseSchema,
  type Post,
  type PostListResponse,
  type Tag,
} from "@ultimate/types";
import { API_BASE, PAGE_SIZE, REVALIDATE } from "@/lib/config";

export interface ListPublishedParams {
  page?: number;
  tag?: string;
}

/** Query công khai — LUÔN ép status=PUBLISHED. */
export function buildPublishedQuery(params: ListPublishedParams): string {
  const sp = new URLSearchParams();
  sp.set("status", "PUBLISHED");
  sp.set("page_size", String(PAGE_SIZE));
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.tag) sp.set("tag", params.tag);
  return `?${sp.toString()}`;
}

const fetchOpts = { next: { revalidate: REVALIDATE } } as const;

export async function listPublished(params: ListPublishedParams = {}): Promise<PostListResponse> {
  const res = await fetch(`${API_BASE}/posts${buildPublishedQuery(params)}`, fetchOpts);
  if (!res.ok) throw new Error(`listPublished failed: ${res.status}`);
  return PostListResponseSchema.parse(await res.json());
}

export async function getPublishedBySlug(slug: string): Promise<Post | null> {
  const res = await fetch(`${API_BASE}/posts/${encodeURIComponent(slug)}`, fetchOpts);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getPublishedBySlug failed: ${res.status}`);
  const post = PostSchema.parse(await res.json());
  return post.status === "PUBLISHED" ? post : null;
}

export async function listTags(): Promise<Tag[]> {
  const res = await fetch(`${API_BASE}/tags`, fetchOpts);
  if (!res.ok) throw new Error(`listTags failed: ${res.status}`);
  return TagListResponseSchema.parse(await res.json()).data;
}

/** Gom toàn bộ bài PUBLISHED (lặp hết trang) — cho sitemap/rss/generateStaticParams. */
export async function listAllPublished(): Promise<Post[]> {
  const all: Post[] = [];
  let page = 1;
  for (;;) {
    const { data, total, page_size } = await listPublished({ page });
    all.push(...data);
    if (data.length === 0 || page * page_size >= total) break;
    page++;
  }
  return all;
}

/** Top bài theo lượt xem (Slice 9: sort=views whitelist ở core). */
export async function listTopViewed(limit = 5): Promise<Post[]> {
  const sp = new URLSearchParams({
    status: "PUBLISHED",
    sort: "views",
    order: "desc",
    page_size: String(limit),
  });
  const res = await fetch(`${API_BASE}/posts?${sp.toString()}`, fetchOpts);
  if (!res.ok) throw new Error(`listTopViewed failed: ${res.status}`);
  return PostListResponseSchema.parse(await res.json()).data;
}
