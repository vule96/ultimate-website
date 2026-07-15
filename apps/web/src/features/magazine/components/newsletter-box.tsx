"use client";
import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useNewsletterForm } from "../hooks/use-newsletter-form";
import { localNewsletterService } from "../services/newsletter-service";

export function NewsletterBox({ variant }: { variant: "rail" | "footer" }) {
  const t = useTranslations("newsletter");
  const errors = useMemo(
    () => ({ invalid: t("errInvalid"), system: t("errSystem") }),
    [t],
  );
  const { email, setEmail, status, submit } = useNewsletterForm(localNewsletterService, errors);
  const invalid = status.kind === "error";

  const form =
    status.kind === "success" ? (
      <p role="status" className="flex items-center gap-2 text-[13px] font-semibold text-ink-fg">
        <CheckCircle2 size={15} className="text-accent" /> {t("success")}
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
            className="min-w-0 flex-1 border-none bg-transparent px-3 py-[10px] text-[12.5px] text-field-fg outline-none"
          />
          <button
            onClick={submit}
            disabled={status.kind === "submitting"}
            className="whitespace-nowrap bg-accent px-[15px] text-[12.5px] font-bold text-white disabled:opacity-60"
          >
            {status.kind === "submitting" ? "…" : t("submit")}
          </button>
        </div>
        {invalid && (
          <p role="alert" className="mt-2 text-[11.5px] font-semibold text-red-400">
            {status.message}
          </p>
        )}
        <p className="mt-2 font-mono text-[10px] text-ink-muted">{t("privacy")}</p>
      </>
    );

  if (variant === "rail") {
    return (
      <div className="mt-7 rounded-xl border-t-2 border-accent bg-ink p-[18px] text-ink-fg">
        <div className="mb-[5px] font-display text-[16px] font-bold leading-[1.15]">
          {t("title")}
        </div>
        <p className="mb-3 text-[11.5px] leading-[1.5] text-ink-muted">{t("benefit")}</p>
        {form}
      </div>
    );
  }
  return <div>{form}</div>;
}
