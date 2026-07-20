"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMagazineStore, useSavedCount } from "../store/magazine-store";

export function AuthMenu() {
  const t = useTranslations("auth");
  const user = useMagazineStore((s) => s.user);
  const openAuth = useMagazineStore((s) => s.openAuth);
  const logout = useMagazineStore((s) => s.logout);
  const deleteAccount = useMagazineStore((s) => s.deleteAccount);
  const savedCount = useSavedCount();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center gap-[9px]">
        <button
          onClick={() => openAuth()}
          className="rounded-lg bg-accent px-[14px] py-[9px] text-[12.5px] font-bold text-white"
        >
          {t("login")}
        </button>
      </div>
    );
  }

  const onConfirmDelete = async () => {
    setDeleting(true);
    setError(false);
    const ok = await deleteAccount();
    setDeleting(false);
    if (ok) setConfirming(false);
    else setError(true);
  };

  return (
    <div className="flex items-center gap-[11px]">
      <span className="rounded-lg border border-chrome-line bg-soft px-[13px] py-[9px] text-[12.5px] font-bold text-chrome-fg">
        {t("savedCount", { count: savedCount })}
      </span>
      <div className="flex items-center gap-2">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent text-[13px] font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="text-[13px] font-semibold text-chrome-fg">{user.name}</span>
      </div>
      <button
        onClick={logout}
        className="rounded-lg border border-chrome-line px-[12px] py-[9px] text-[12px] text-chrome-muted"
      >
        {t("logout")}
      </button>
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg px-[12px] py-[9px] text-[12px] text-chrome-muted hover:text-accent"
      >
        {t("deleteAccount")}
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-fg/30 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t("deleteAccount")}
          onClick={() => !deleting && setConfirming(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-chrome-line bg-bg p-6 shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-[16px] font-bold text-fg">{t("deleteAccount")}</h2>
            <p className="mb-5 text-[13.5px] text-muted">{t("deleteAccountConfirm")}</p>
            {error && (
              <p role="alert" className="mb-3 text-[13px] text-accent">
                {t("deleteError")}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="rounded-lg border border-chrome-line px-4 py-2 text-[13px] font-semibold text-chrome-fg disabled:opacity-60"
              >
                {t("deleteAccountCancel")}
              </button>
              <button
                onClick={onConfirmDelete}
                disabled={deleting}
                className="rounded-lg bg-accent px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
              >
                {t("deleteAccount")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
