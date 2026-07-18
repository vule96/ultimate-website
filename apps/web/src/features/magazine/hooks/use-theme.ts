"use client";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mach-theme";

// Script chạy trước hydration để set class ngay, tránh nháy màu (FOUC).
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export function useTheme(): { dark: boolean; toggle: () => void } {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Đọc trạng thái theme do THEME_SCRIPT set trước hydration (external DOM state).
    // Phải set sau mount, không lazy-init: server render `false`, lazy-init `true`
    // sẽ gây hydration mismatch. Đây là ca "read from external system" hợp lệ.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      return next;
    });
  }, []);

  return { dark, toggle };
}
