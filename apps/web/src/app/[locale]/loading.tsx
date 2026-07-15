import { ArticleRowSkeleton } from "@/features/magazine/components/skeletons/article-row-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-shell px-[26px] py-10">
      <div className="mb-[18px] h-8 w-40 animate-pulse rounded bg-soft" />
      {Array.from({ length: 6 }).map((_, i) => (
        <ArticleRowSkeleton key={i} />
      ))}
    </div>
  );
}
