import type { Post } from "@ultimate/types";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRssXml(posts: Post[], siteUrl: string, siteName: string): string {
  const items = posts
    .map((p) => {
      const link = escapeXml(`${siteUrl}/blog/${p.slug}`);
      const pubDate = p.published_at ? new Date(p.published_at).toUTCString() : "";
      return [
        "    <item>",
        `      <title>${escapeXml(p.title)}</title>`,
        `      <link>${link}</link>`,
        `      <guid isPermaLink="true">${link}</guid>`,
        pubDate ? `      <pubDate>${pubDate}</pubDate>` : "",
        `      <description>${escapeXml(p.excerpt ?? "")}</description>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const latest = posts.find((p) => p.published_at)?.published_at;
  const lastBuild = latest ? new Date(latest).toUTCString() : "";

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(siteName)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <atom:link rel="self" href="${escapeXml(siteUrl + "/rss.xml")}" type="application/rss+xml" />`,
    `    <description>${escapeXml(siteName)}</description>`,
    "    <language>vi</language>",
    lastBuild ? `    <lastBuildDate>${lastBuild}</lastBuildDate>` : "",
    items,
    "  </channel>",
    "</rss>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
