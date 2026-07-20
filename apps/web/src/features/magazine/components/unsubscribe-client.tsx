"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PUBLIC_API_URL } from "@/lib/config";

type State = "idle" | "submitting" | "success" | "invalid" | "error";

export function UnsubscribeClient({ token }: { token: string }) {
  const t = useTranslations("unsubscribe");
  const [state, setState] = useState<State>("idle");

  if (!token) {
    return (
      <Result>
        <p role="alert" className="text-[15px] text-fg">
          {t("missingToken")}
        </p>
        <HomeLink label={t("backHome")} />
      </Result>
    );
  }

  const submit = async () => {
    setState("submitting");
    try {
      const res = await fetch(`${PUBLIC_API_URL}/api/v1/subscribers/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.status === 204) setState("success");
      else if (res.status === 404 || res.status === 400) setState("invalid");
      else setState("error");
    } catch {
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <Result>
        <p className="text-[15px] font-semibold text-fg">{t("success")}</p>
        <HomeLink label={t("backHome")} />
      </Result>
    );
  }

  if (state === "invalid") {
    return (
      <Result>
        <p role="alert" className="text-[15px] text-fg">
          {t("invalid")}
        </p>
        <HomeLink label={t("backHome")} />
      </Result>
    );
  }

  return (
    <Result>
      <p className="text-[15px] text-muted">{t("intro")}</p>
      {state === "error" && (
        <p role="alert" className="text-[13px] text-accent">
          {t("invalid")}
        </p>
      )}
      <button
        onClick={submit}
        disabled={state === "submitting"}
        className="mt-2 rounded-lg bg-accent px-5 py-3 text-[14px] font-bold text-white disabled:opacity-60"
      >
        {state === "submitting" ? t("submitting") : t("confirm")}
      </button>
      <HomeLink label={t("backHome")} />
    </Result>
  );
}

function Result({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-start gap-4">{children}</div>;
}

function HomeLink({ label }: { label: string }) {
  return (
    <Link href="/" className="text-[13px] font-semibold text-accent no-underline hover:opacity-75">
      {label}
    </Link>
  );
}
