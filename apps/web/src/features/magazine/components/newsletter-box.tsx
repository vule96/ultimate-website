"use client";
import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useNewsletterForm } from "../hooks/use-newsletter-form";
import { localNewsletterService } from "../services/newsletter-service";

type Variant = "band" | "footer";

export function NewsletterBox({ variant }: { variant: Variant }) {
  const t = useTranslations("newsletter");
  const errors = useMemo(() => ({ invalid: t("errInvalid"), system: t("errSystem") }), [t]);
  const { email, setEmail, status, submit } = useNewsletterForm(localNewsletterService, errors);
  const invalid = status.kind === "error";
  const big = variant === "band";

  const form =
    status.kind === "success" ? (
      <p
        role="status"
        className={`flex items-center gap-2 font-semibold text-ink-fg ${big ? "text-[15px]" : "text-[13px]"}`}
      >
        <CheckCircle2 size={big ? 18 : 15} className="text-accent" /> {t("success")}
      </p>
    ) : (
      <>
        <div
          className={`flex overflow-hidden rounded-lg border ${
            invalid ? "border-red-400" : "border-transparent"
          } bg-field-bg focus-within:ring-2 focus-within:ring-field-ring`}
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={t("placeholder")}
            aria-invalid={invalid || undefined}
            disabled={status.kind === "submitting"}
            className={`min-w-0 flex-1 border-none bg-transparent text-field-fg outline-none ${
              big ? "px-4 py-[14px] text-[14px]" : "px-3 py-[10px] text-[12.5px]"
            }`}
          />
          <button
            onClick={submit}
            disabled={status.kind === "submitting"}
            className={`whitespace-nowrap bg-accent font-bold text-white disabled:opacity-60 ${
              big ? "px-6 text-[14px]" : "px-[15px] text-[12.5px]"
            }`}
          >
            {status.kind === "submitting" ? "…" : t("submit")}
          </button>
        </div>
        {invalid && (
          <p
            role="alert"
            className={`mt-2 font-semibold text-red-400 ${big ? "text-[12.5px]" : "text-[11.5px]"}`}
          >
            {status.message}
          </p>
        )}
        <p className="mt-2 font-mono text-[10px] text-ink-muted">{t("privacy")}</p>
      </>
    );

  if (variant === "band") {
    return (
      <section aria-label={t("title")} className="border-t-2 border-accent bg-ink text-ink-fg">
        <div className="mx-auto grid max-w-shell items-center gap-6 px-5 py-10 sm:px-[30px] lg:grid-cols-[1.2fr_1fr] lg:gap-12">
          <div>
            <h2 className="m-0 font-display text-[24px] font-extrabold leading-[1.15] tracking-[-0.01em] sm:text-[28px]">
              {t("title")}
            </h2>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-ink-muted sm:text-[14px]">
              {t("benefit")}
            </p>
          </div>
          <div>{form}</div>
        </div>
      </section>
    );
  }
  return <div>{form}</div>;
}
