import { Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import type { Tag, PostStatus } from "@ultimate/types";
import { Input } from "@ultimate/ui";
import { Button } from "@ultimate/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ultimate/ui";

const ALL = "ALL"; // sentinel: radix Select không cho phép value rỗng

const statusOptions: { value: PostStatus; label: string }[] = [
  { value: "PUBLISHED", label: "Đã đăng" },
  { value: "DRAFT", label: "Nháp" },
  { value: "PENDING_APPROVAL", label: "Chờ duyệt" },
];

export function PostsToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  tag,
  onTagChange,
  tags,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  status: PostStatus | "";
  onStatusChange: (v: PostStatus | "") => void;
  tag: string;
  onTagChange: (v: string) => void;
  tags: Tag[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm theo tiêu đề…"
          className="pl-9"
        />
      </div>

      <Select
        value={status || ALL}
        onValueChange={(v) => onStatusChange(v === ALL ? "" : (v as PostStatus))}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Trạng thái" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tất cả trạng thái</SelectItem>
          {statusOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={tag || ALL} onValueChange={(v) => onTagChange(v === ALL ? "" : v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tất cả tag</SelectItem>
          {tags.map((t) => (
            <SelectItem key={t.id} value={t.slug}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button asChild>
        <Link to="/posts/new">
          <Plus /> Thêm bài viết
        </Link>
      </Button>
    </div>
  );
}
