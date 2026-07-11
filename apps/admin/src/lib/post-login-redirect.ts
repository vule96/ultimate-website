const KEY = "postLoginRedirect";

// Chỉ chấp nhận path nội bộ tuyệt đối ("/..." nhưng không "//") — tránh open-redirect.
// Chặn cả backslash (trình duyệt coi "\" như "/", nên "/\evil.com" là protocol-relative)
// và ký tự điều khiển — defense-in-depth dù nguồn hiện tại là location của chính router.
function isInternalPath(p: string): boolean {
  if (!p.startsWith("/") || p.startsWith("//")) return false;
  if (p.includes("\\")) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(p)) return false;
  return true;
}

export function savePostLoginRedirect(path: string): void {
  if (isInternalPath(path)) sessionStorage.setItem(KEY, path);
}

export function takePostLoginRedirect(): string | null {
  const p = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  return p && isInternalPath(p) ? p : null;
}
