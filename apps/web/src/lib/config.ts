/** Base URL core (server-only). Không prefix NEXT_PUBLIC → không lộ ra client. */
export const CORE_API_URL = process.env.CORE_API_URL ?? "http://localhost:8080";
export const API_BASE = `${CORE_API_URL}/api/v1`;

/** URL site công khai (client-safe) — dùng cho canonical/sitemap/rss/OG. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_NAME = "Ultimate website";

export const REVALIDATE = 60;
export const PAGE_SIZE = 10;

/** Base URL core cho CLIENT (beacon view...) — bắt buộc NEXT_PUBLIC. */
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
