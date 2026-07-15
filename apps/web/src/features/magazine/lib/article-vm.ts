import type { Post } from "@ultimate/types";
import type { ArticleVM, CategoryKey } from "../types";
import { categoryFromTags, CATEGORY_BY_KEY } from "../categories";
import { formatDate, readMinutesFromHtml } from "./format";

/** Chuỗi hiển thị phụ thuộc locale — server page bơm từ next-intl. */
export interface ArticleVMLabels {
  category(key: CategoryKey): string;
  readTime(minutes: number): string;
}

export function postToArticleVM(post: Post, labels: ArticleVMLabels): ArticleVM {
  const category = categoryFromTags(post.tags);
  const cfg = CATEGORY_BY_KEY[category];
  const date = post.published_at ?? post.created_at;
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? "",
    category,
    categoryLabel: labels.category(category),
    color: cfg.color,
    date,
    dateLabel: formatDate(date),
    readTime: labels.readTime(readMinutesFromHtml(post.content_html)),
    coverImage: post.cover_image,
    author: null,
    views: null,
    comments: null,
  };
}

export function postsToArticleVMs(posts: Post[], labels: ArticleVMLabels): ArticleVM[] {
  return posts.map((p) => postToArticleVM(p, labels));
}
