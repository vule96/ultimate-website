import type { LucideIcon } from "lucide-react";

export type CategoryKey =
  | "all"
  | "it"
  | "ai"
  | "finance"
  | "stock"
  | "arch"
  | "culture"
  | "ent"
  | "news"
  | "growth"
  | "book";

export interface Category {
  key: CategoryKey;
  label: string;
  color: string; // hex — nguồn duy nhất cho màu category
  icon: LucideIcon;
}

export interface ArticleVM {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: CategoryKey;
  categoryLabel: string;
  color: string;
  date: string; // ISO
  dateLabel: string; // dd/mm/yyyy
  readTime: string; // "N phút"
  coverImage: string | null;
  author: string | null;
  views: number | null;
  comments: number | null;
}

export interface MockUser {
  name: string;
  email: string;
}
