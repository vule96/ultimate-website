// Dữ liệu giả cho Dashboard ở 3a — sẽ thay bằng API thật ở 3b.
import type { PostStatus } from "@ultimate/types";

export const stats = {
  total: 128,
  published: 96,
  draft: 27,
  tags: 34,
};

export const postsOverTime = [
  { month: "T1", posts: 6 },
  { month: "T2", posts: 9 },
  { month: "T3", posts: 7 },
  { month: "T4", posts: 12 },
  { month: "T5", posts: 10 },
  { month: "T6", posts: 15 },
  { month: "T7", posts: 13 },
  { month: "T8", posts: 18 },
];

export interface RecentPost {
  id: string;
  title: string;
  status: PostStatus;
  date: string;
}

export const recentPosts: RecentPost[] = [
  { id: "1", title: "Lập trình Go cho người mới bắt đầu", status: "PUBLISHED", date: "05 Th7" },
  { id: "2", title: "Clean Architecture trong thực tế", status: "PUBLISHED", date: "03 Th7" },
  { id: "3", title: "So sánh Gin vs Chi vs Fiber", status: "DRAFT", date: "01 Th7" },
  { id: "4", title: "pgvector: RAG với Postgres", status: "PENDING_APPROVAL", date: "28 Th6" },
  { id: "5", title: "Triển khai OAuth theo BFF pattern", status: "PUBLISHED", date: "25 Th6" },
];
