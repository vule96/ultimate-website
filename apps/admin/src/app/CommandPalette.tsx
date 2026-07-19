import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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

type Cmd = { label: string; to: string; icon: typeof LayoutDashboard; keywords?: string };

const COMMANDS: Cmd[] = [
  { label: "Tổng quan", to: "/", icon: LayoutDashboard, keywords: "dashboard home" },
  { label: "Viết bài mới", to: "/posts/new", icon: PlusCircle, keywords: "new post tạo" },
  { label: "Bài viết", to: "/posts", icon: FileText, keywords: "posts" },
  { label: "Tags", to: "/tags", icon: Tags },
  { label: "Media", to: "/media", icon: Image, keywords: "ảnh image" },
  { label: "Người đăng ký", to: "/subscribers", icon: Mail, keywords: "subscribers newsletter" },
  { label: "Người đọc", to: "/readers", icon: Users, keywords: "readers" },
  { label: "Cài đặt", to: "/settings", icon: Settings, keywords: "settings" },
];

/** Command palette ⌘K — điều hướng nhanh. Mở bằng ⌘/Ctrl+K hoặc event "open-command". */
export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COMMANDS;
    return COMMANDS.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(s));
  }, [q]);

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
      setActive(0);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const go = (to: string) => {
    setOpen(false);
    void navigate({ to });
  };

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
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                go(results[active].to);
              }
            }}
            placeholder="Đi tới trang, thao tác…"
            className="w-full bg-transparent py-3.5 text-[14px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[320px] overflow-y-auto p-1.5">
          {results.map((c, i) => (
            <li key={c.to}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(c.to)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] ${
                  i === active ? "bg-accent text-accent-foreground" : "text-foreground"
                }`}
              >
                <c.icon className="size-[17px] opacity-80" />
                {c.label}
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">
              Không tìm thấy.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
