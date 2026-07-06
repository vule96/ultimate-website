import { Plus, Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/features/auth/context";

export function Topbar({ title }: { title: string }) {
  const { user, signOut } = useAuth();
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Thông báo">
          <Bell className="size-5 text-muted-foreground" />
        </Button>
        <Button>
          <Plus />
          Thêm bài viết
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
