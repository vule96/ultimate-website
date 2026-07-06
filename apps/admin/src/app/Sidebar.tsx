import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Tags,
  Image,
  Settings,
  Search,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/features/auth/context";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/posts", label: "Bài viết", icon: FileText },
  { to: "/tags", label: "Tags", icon: Tags },
  { to: "/media", label: "Media", icon: Image },
];

const secondary = [{ to: "/settings", label: "Cài đặt", icon: Settings }];

export function Sidebar() {
  const { user } = useAuth();
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <span className="text-sm font-bold">U</span>
        </div>
        <span className="text-[15px] font-semibold tracking-tight">Ultimate Blog</span>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          <Search className="size-4" />
          <span>Tìm kiếm…</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Menu
        </p>
        {nav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
        <p className="px-3 pb-1 pt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Khác
        </p>
        {secondary.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Workspace / user */}
      <div className="border-t border-border p-3">
        <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-secondary">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chip-orange/15 text-sm font-semibold text-chip-orange">
            {(user?.email ?? "A").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.email ?? "Admin"}</p>
            <p className="text-xs text-muted-foreground">Workspace</p>
          </div>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )
      }
    >
      <Icon className="size-[18px]" />
      {label}
    </NavLink>
  );
}
