"use client";
import { useMagazineStore, useSavedCount } from "../store/magazine-store";

export function AuthMenu() {
  const user = useMagazineStore((s) => s.user);
  const openAuth = useMagazineStore((s) => s.openAuth);
  const logout = useMagazineStore((s) => s.logout);
  const savedCount = useSavedCount();

  if (!user) {
    return (
      <div className="flex items-center gap-[9px]">
        <button
          onClick={() => openAuth("login")}
          className="rounded-lg border border-white/40 bg-white/15 px-[14px] py-[9px] text-[12.5px] font-semibold text-white"
        >
          Đăng nhập
        </button>
        <button
          onClick={() => openAuth("register")}
          className="rounded-lg bg-white px-[14px] py-[9px] text-[12.5px] font-bold text-accent"
        >
          Đăng ký
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-[11px]">
      <span className="rounded-lg border border-white/40 bg-white/15 px-[13px] py-[9px] text-[12.5px] font-bold text-white">
        Đã lưu {savedCount}
      </span>
      <div className="flex items-center gap-2">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white text-[13px] font-bold text-accent">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="text-[13px] font-semibold text-white">{user.name}</span>
      </div>
      <button
        onClick={logout}
        className="rounded-lg border border-white/40 px-[12px] py-[9px] text-[12px] text-white"
      >
        Thoát
      </button>
    </div>
  );
}
