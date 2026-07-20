import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FileText,
  Tags,
  Image,
  Mail,
  Users,
  Settings,
  PlusCircle,
  Search,
} from "lucide-react";
import { listPosts } from "@/features/posts/api";

type NavCmd = { label: string; to: string; icon: typeof LayoutDashboard; keywords?: string };

const COMMANDS: NavCmd[] = [
  { label: "Tổng quan", to: "/", icon: LayoutDashboard, keywords: "dashboard home" },
  { label: "Viết bài mới", to: "/posts/new", icon: PlusCircle, keywords: "new post tạo" },
  { label: "Bài viết", to: "/posts", icon: FileText, keywords: "posts" },
  { label: "Tags", to: "/tags", icon: Tags },
  { label: "Media", to: "/media", icon: Image, keywords: "ảnh image" },
  { label: "Người đăng ký", to: "/subscribers", icon: Mail, keywords: "subscribers newsletter" },
  { label: "Người đọc", to: "/readers", icon: Users, keywords: "readers" },
  { label: "Cài đặt", to: "/settings", icon: Settings, keywords: "settings" },
];

// Item phẳng để điều hướng phím gộp cả nav tĩnh + bài viết động.
type Item =
  | { kind: "nav"; label: string; icon: typeof LayoutDashboard; to: string }
  | { kind: "post"; label: string; slug: string };

/** Command palette ⌘K — điều hướng nhanh + tìm bài viết thật. Mở bằng ⌘/Ctrl+K hoặc event "open-command". */
export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce 250ms cho query bài viết (tránh gọi API mỗi phím).
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const navItems = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? COMMANDS.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(s))
      : COMMANDS;
    return list;
  }, [q]);

  const postsQuery = useQuery({
    queryKey: ["cmdk-posts", debouncedQ],
    queryFn: ({ signal }) => listPosts({ q: debouncedQ, pageSize: 5 }, signal),
    enabled: open && debouncedQ.length > 0,
  });

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = navItems.map((c) => ({ kind: "nav", label: c.label, icon: c.icon, to: c.to }));
    const posts: Item[] = (postsQuery.data?.data ?? []).map((p) => ({
      kind: "post",
      label: p.title,
      slug: p.slug,
    }));
    return [...nav, ...posts];
  }, [navItems, postsQuery.data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setDebouncedQ("");
      setActive(0);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [items.length]);

  if (!open) return null;

  const run = (item: Item) => {
    setOpen(false);
    if (item.kind === "nav") void navigate({ to: item.to });
    else void navigate({ to: "/posts/$slug/edit", params: { slug: item.slug } });
  };

  const showPostsHint = debouncedQ.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/25 p-4 pt-[18vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Điều hướng nhanh"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-3.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && items[active]) {
                run(items[active]);
              }
            }}
            placeholder="Đi tới trang, tìm bài viết…"
            className="w-full bg-transparent py-3.5 text-[14px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[360px] overflow-y-auto p-1.5">
          {items.map((c, i) => (
            <li key={c.kind === "nav" ? `nav:${c.to}` : `post:${c.slug}`}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => run(c)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] ${
                  i === active ? "bg-accent text-accent-foreground" : "text-foreground"
                }`}
              >
                {c.kind === "nav" ? (
                  <c.icon className="size-[17px] opacity-80" />
                ) : (
                  <FileText className="size-[17px] opacity-60" />
                )}
                <span className="truncate">{c.label}</span>
              </button>
            </li>
          ))}
          {showPostsHint && postsQuery.isFetching && (
            <li className="px-3 py-2 text-[12.5px] text-muted-foreground">Đang tìm bài viết…</li>
          )}
          {items.length === 0 && !postsQuery.isFetching && (
            <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">
              Không tìm thấy.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
