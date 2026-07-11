import { Plus, Bell, LogOut } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@ultimate/ui";
import { Avatar, AvatarFallback } from "@ultimate/ui";
import { useAuth, useSignOut } from "@/features/auth/hooks";

export function Topbar({ title }: { title: string }) {
  const { user } = useAuth();
  const signOut = useSignOut();
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Thông báo">
          <Bell className="size-5 text-muted-foreground" />
        </Button>
        <Button asChild>
          <Link to="/posts/new">
            <Plus />
            Thêm bài viết
          </Link>
        </Button>
        <Avatar>
          <AvatarFallback>{(user?.email ?? "A").charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <Button variant="ghost" size="icon" aria-label="Đăng xuất" onClick={() => void signOut()}>
          <LogOut className="size-5 text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}
