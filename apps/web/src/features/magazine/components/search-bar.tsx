"use client";
import { Search } from "lucide-react";
import { useMagazineStore } from "../store/magazine-store";

export function SearchBar() {
  const query = useMagazineStore((s) => s.query);
  const setQuery = useMagazineStore((s) => s.setQuery);
  return (
    <div className="flex max-w-[400px] flex-1 items-center gap-[9px] rounded-[9px] border border-white/35 bg-white/15 px-[15px] py-[10px]">
      <Search size={15} className="flex-none text-white" strokeWidth={2} />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm bài viết, chủ đề, tác giả…"
        className="flex-1 border-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-white/70"
      />
    </div>
  );
}
