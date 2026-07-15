"use client";
import { useTranslations } from "next-intl";
import { useMagazineStore, useSavedCount } from "../store/magazine-store";

export function AuthMenu() {
  const t = useTranslations("auth");
  const user = useMagazineStore((s) => s.user);
  const openAuth = useMagazineStore((s) => s.openAuth);
  const logout = useMagazineStore((s) => s.logout);
  const savedCount = useSavedCount();

  if (!user) {
    return (
      <div className="flex items-center gap-[9px]">
        <button
          onClick={() => openAuth("login")}
          className="rounded-lg border border-chrome-line bg-soft px-[14px] py-[9px] text-[12.5px] font-semibold text-chrome-fg"
        >
          {t("login")}
        </button>
        <button
          onClick={() => openAuth("register")}
          className="rounded-lg bg-accent px-[14px] py-[9px] text-[12.5px] font-bold text-white"
        >
          {t("register")}
        </button>
      </div>
    );
  }
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
    </div>
  );
}
