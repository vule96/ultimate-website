import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Tags,
  Image,
  Mail,
  Users,
  Settings,
  Search,
  LogOut,
} from "lucide-react";
import { cn } from "@ultimate/ui";
import { useAuth, useSignOut } from "@/features/auth/hooks";

type NavItemDef = { to: string; label: string; icon: typeof LayoutDashboard };

const groups: { label: string; items: NavItemDef[] }[] = [
  {
    label: "Nội dung",
    items: [
      { to: "/", label: "Tổng quan", icon: LayoutDashboard },
      { to: "/posts", label: "Bài viết", icon: FileText },
      { to: "/tags", label: "Tags", icon: Tags },
      { to: "/media", label: "Media", icon: Image },
    ],
  },
  {
    label: "Người dùng",
    items: [
      { to: "/subscribers", label: "Người đăng ký", icon: Mail },
      { to: "/readers", label: "Người đọc", icon: Users },
    ],
  },
  { label: "Hệ thống", items: [{ to: "/settings", label: "Cài đặt", icon: Settings }] },
];

export function Sidebar() {
  const { user } = useAuth();
  const signOut = useSignOut();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-[18px] py-[18px]">
        <div className="flex size-[30px] items-center justify-center rounded-[9px] bg-gradient-to-br from-primary to-[#1682bd] text-[16px] font-extrabold text-white shadow-[0_4px_10px_hsl(var(--primary)/0.3)]">
          M
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight">Mạch</div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Admin
          </div>
        </div>
      </div>

      {/* Command hint */}
      <div className="mx-[14px] mb-3 flex items-center gap-2 rounded-[9px] border border-border bg-secondary px-2.5 py-2 text-[13px] text-muted-foreground">
        <Search className="size-4" />
        <span>Tìm nhanh…</span>
        <kbd className="ml-auto rounded border border-border bg-card px-1.5 py-px font-mono text-[10.5px]">
          ⌘K
        </kbd>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-[10px] pb-3">
        {groups.map((g) => (
          <div key={g.label} className="mb-1">
            <p className="px-2.5 pb-1.5 pt-2.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
              {g.label}
            </p>
            {g.items.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="flex items-center gap-2.5 border-t border-border p-3.5">
        <div className="flex size-[30px] items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-accent-foreground">
          {(user?.email ?? "A").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{user?.email ?? "Admin"}</p>
          <p className="text-[11px] text-muted-foreground">Quản trị viên</p>
        </div>
        <button
          onClick={() => void signOut()}
          aria-label="Thoát"
          className="text-muted-foreground transition-colors hover:text-destructive"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
}

function NavItem({ to, label, icon: Icon }: NavItemDef) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className={cn(
        "flex items-center gap-[11px] rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors",
        "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
      activeProps={{
        className: "bg-accent text-accent-foreground font-semibold hover:bg-accent",
      }}
    >
      <Icon className="size-[17px]" />
      {label}
    </Link>
  );
}
