import { CATEGORIES } from "../categories";
import { NewsletterBox } from "./newsletter-box";

const SOCIAL = ["f", "in", "X", "YT"];

export function MagazineFooter() {
  return (
    <footer className="bg-ink px-[30px] pb-6 pt-[46px] text-ink-fg">
      <div className="mx-auto grid max-w-shell grid-cols-[1.7fr_1fr_1fr_1.3fr] gap-[38px] border-b border-ink-fg/15 pb-8">
        <div>
          <div className="mb-[11px] font-display text-[27px] font-extrabold tracking-[-0.015em] text-accent">
            Mạch
          </div>
          <p className="mb-[18px] max-w-[290px] text-[13px] leading-[1.65] text-ink-muted">
            Tạp chí tri thức cho người trẻ dám nghĩ — công nghệ, tài chính, kiến trúc, văn hoá và
            những gì đáng đọc mỗi ngày.
          </p>
          <div className="flex gap-[9px]">
            {SOCIAL.map((s) => (
              <a
                key={s}
                href="/"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-ink-fg/10 text-[13px] font-bold text-ink-fg no-underline"
              >
                {s}
              </a>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-[15px] font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            Chuyên mục
          </div>
          <div className="flex flex-col gap-[10px]">
            {CATEGORIES.filter((c) => c.key !== "all")
              .slice(0, 6)
              .map((c) => (
                <a key={c.key} href="/tags" className="text-[13px] text-ink-muted no-underline">
                  {c.label}
                </a>
              ))}
          </div>
        </div>
        <div>
          <div className="mb-[15px] font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            Về Mạch
          </div>
          <div className="flex flex-col gap-[10px] text-[13px]">
            {["Giới thiệu", "Viết cho Mạch", "Liên hệ", "Tuyển dụng"].map((t) => (
              <a key={t} href="/" className="text-ink-muted no-underline">
                {t}
              </a>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-[15px] font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            Bản tin
          </div>
          <p className="mb-3 text-[12.5px] leading-[1.55] text-ink-muted">
            Bài hay nhất mỗi sáng thứ Hai.
          </p>
          <NewsletterBox variant="footer" />
        </div>
      </div>
      <div className="mx-auto flex max-w-shell flex-wrap justify-between gap-[10px] pt-5 font-mono text-[11px] text-ink-muted">
        <span>© 2026 Mạch. Bảo lưu mọi quyền.</span>
        <span>Điều khoản · Bảo mật · Cookie</span>
      </div>
    </footer>
  );
}
