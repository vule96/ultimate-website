import { FileText, CheckCircle2, PencilLine, Tags } from "lucide-react";
import { useAuth } from "@/features/auth/hooks";
import { useStatsSuspense } from "@/features/posts/queries";
import { StatCard } from "./widgets/StatCard";
import { PostsChart } from "./widgets/PostsChart";
import { RecentPosts } from "./widgets/RecentPosts";

export function DashboardPage() {
  const { user } = useAuth();
  const name = user.email.split("@")[0] ?? "bạn";
  const { data: stats } = useStatsSuspense();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Chào mừng trở lại, {name} 👋</h2>
        <p className="mt-1 text-muted-foreground">Tổng quan nội dung blog của bạn.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tổng bài viết" value={String(stats.total)} icon={FileText} chip="blue" />
        <StatCard label="Đã đăng" value={String(stats.published)} icon={CheckCircle2} chip="green" />
        <StatCard label="Bản nháp" value={String(stats.draft)} icon={PencilLine} chip="orange" />
        <StatCard label="Tags" value={String(stats.tags)} icon={Tags} chip="violet" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PostsChart />
        </div>
        <div>
          <RecentPosts />
        </div>
      </div>
    </div>
  );
}
