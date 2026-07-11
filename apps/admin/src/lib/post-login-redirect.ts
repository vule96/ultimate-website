const KEY = "postLoginRedirect";

// Chỉ chấp nhận path nội bộ tuyệt đối ("/..." nhưng không "//") — tránh open-redirect.
function isInternalPath(p: string): boolean {
  return p.startsWith("/") && !p.startsWith("//");
}

export function savePostLoginRedirect(path: string): void {
  if (isInternalPath(path)) sessionStorage.setItem(KEY, path);
}

export function takePostLoginRedirect(): string | null {
  const p = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  return p && isInternalPath(p) ? p : null;
}
