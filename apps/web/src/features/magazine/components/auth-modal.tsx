"use client";
import { useState } from "react";
import { m } from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMagazineStore } from "../store/magazine-store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// MOCK auth: chỉ validate + set user cục bộ. TODO: nối Firebase/Go core BFF.
export function AuthModal() {
  const t = useTranslations("auth");
  const mode = useMagazineStore((s) => s.authMode);
  const close = useMagazineStore((s) => s.closeAuth);
  const openAuth = useMagazineStore((s) => s.openAuth);
  const login = useMagazineStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const isRegister = mode === "register";

  const submit = () => {
    if (!EMAIL_RE.test(email)) return setMsg(t("errInvalidEmail"));
    if (!pass) return setMsg(t("errNoPassword"));
    const displayName = isRegister ? name.trim() || email.split("@")[0] : email.split("@")[0];
    login({ name: displayName, email });
  };

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={close}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(8,12,22,0.55)] p-5"
    >
      <m.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-[384px] max-w-full rounded-[14px] bg-surface p-[30px] text-fg shadow-modal"
      >
        <div className="mb-[6px] flex items-start justify-between">
          <h3 className="m-0 font-display text-[24px] font-extrabold tracking-[-0.02em]">
            {isRegister ? t("register") : t("login")}
          </h3>
          <button
            onClick={close}
            aria-label={t("closeAria")}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-soft text-muted"
          >
            <X size={17} />
          </button>
        </div>
        <p className="mb-5 text-[13px] leading-[1.5] text-muted">
          {isRegister ? t("subtitleRegister") : t("subtitleLogin")}
        </p>
        {isRegister && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className="mb-[11px] w-full rounded-[9px] border border-line bg-bg px-[14px] py-3 text-[13.5px] text-fg outline-none"
          />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          className="mb-[11px] w-full rounded-[9px] border border-line bg-bg px-[14px] py-3 text-[13.5px] text-fg outline-none"
        />
        <input
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          type="password"
          placeholder={t("passwordPlaceholder")}
          className="mb-[11px] w-full rounded-[9px] border border-line bg-bg px-[14px] py-3 text-[13.5px] text-fg outline-none"
        />
        {msg && <p className="mb-3 text-[12.5px] font-semibold text-accent">{msg}</p>}
        <button
          onClick={submit}
          className="mb-[15px] w-full rounded-[9px] bg-accent py-[13px] text-[14px] font-bold text-white"
        >
          {isRegister ? t("register") : t("login")}
        </button>
        <div className="text-center text-[13px] text-muted">
          {isRegister ? t("haveAccount") : t("noAccount")}{" "}
          <button
            onClick={() => {
              setMsg("");
              openAuth(isRegister ? "login" : "register");
            }}
            className="font-bold text-accent"
          >
            {isRegister ? t("login") : t("register")}
          </button>
        </div>
      </m.div>
    </m.div>
  );
}
