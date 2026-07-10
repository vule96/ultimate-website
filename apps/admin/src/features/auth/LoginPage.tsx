import { Card, CardContent } from "@ultimate/ui";
import { Button } from "@ultimate/ui";
import { googleLoginUrl } from "./api";

export function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Ánh sáng emerald mềm phía sau thẻ đăng nhập */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.12),transparent_68%)]"
      />
      <Card className="relative w-full max-w-sm border-border/80 shadow-xl">
        <CardContent className="flex flex-col items-center gap-7 p-9">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_6px_16px_hsl(var(--primary)/0.35)]">
              <span className="text-2xl font-bold">U</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Ultimate Blog</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Đăng nhập để quản trị nội dung
              </p>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => window.location.assign(googleLoginUrl)}
          >
            <GoogleGlyph />
            Đăng nhập với Google
          </Button>

          <p className="max-w-[16rem] text-center text-xs leading-relaxed text-muted-foreground">
            Chỉ tài khoản trong danh sách cho phép mới truy cập được.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 11v2.8h3.9c-.2 1-1.5 2.9-3.9 2.9-2.4 0-4.3-2-4.3-4.4S9.6 7.9 12 7.9c1.3 0 2.2.6 2.7 1.1l1.8-1.8C15.4 6.1 13.9 5.4 12 5.4 8.3 5.4 5.3 8.4 5.3 12s3 6.6 6.7 6.6c3.9 0 6.4-2.7 6.4-6.5 0-.4 0-.8-.1-1.1H12z"
      />
    </svg>
  );
}
