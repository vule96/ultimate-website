import type { Post } from "@ultimate/types";
import type { ArticleVM } from "../types";
import { categoryFromTags, CATEGORY_BY_KEY } from "../categories";
import { formatDate, readTimeFromHtml } from "./format";

export function postToArticleVM(post: Post): ArticleVM {
  const category = categoryFromTags(post.tags);
  const cfg = CATEGORY_BY_KEY[category];
  const date = post.published_at ?? post.created_at;
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? "",
    category,
    categoryLabel: cfg.label,
    color: cfg.color,
    date,
    dateLabel: formatDate(date),
    readTime: readTimeFromHtml(post.content_html),
    coverImage: post.cover_image,
    author: null,
    views: null,
    comments: null,
  };
}

export function postsToArticleVMs(posts: Post[]): ArticleVM[] {
  return posts.map(postToArticleVM);
}
