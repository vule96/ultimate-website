import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { postsOverTime } from "../mockData";

export function PostsChart() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Bài viết theo thời gian</CardTitle>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            dữ liệu mẫu
          </span>
        </div>
        <p className="text-sm text-muted-foreground">8 tháng gần nhất</p>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={postsOverTime} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="fillPosts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(142 72% 36%)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(142 72% 36%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "hsl(220 9% 46%)" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={40}
                tick={{ fontSize: 12, fill: "hsl(220 9% 46%)" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(220 16% 92%)",
                  fontSize: 13,
                }}
              />
              <Area
                type="monotone"
                dataKey="posts"
                stroke="hsl(142 72% 36%)"
                strokeWidth={2.5}
                fill="url(#fillPosts)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
