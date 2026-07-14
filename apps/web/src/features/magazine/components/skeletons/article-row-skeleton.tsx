export function ArticleRowSkeleton() {
  return (
    <div className="flex animate-pulse items-start gap-[18px] border-b border-line py-[19px]">
      <div className="h-[90px] w-[132px] flex-none rounded-lg bg-soft" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-24 rounded bg-soft" />
        <div className="h-5 w-3/4 rounded bg-soft" />
        <div className="h-3 w-full rounded bg-soft" />
      </div>
    </div>
  );
}
