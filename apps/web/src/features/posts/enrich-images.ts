import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";
import type { ImageMeta } from "@ultimate/types";

/**
 * Plugin rehype: làm giàu <img> trong content_html.
 * - Luôn: loading=lazy + decoding=async.
 * - Khớp meta (backend đo lúc save): width/height (browser reserve đúng tỉ lệ
 *   → CLS 0) + background placeholder PNG data URI (hiện tức thì khi ảnh chưa về).
 *
 * BẮT BUỘC chạy SAU rehype-sanitize: style ở đây do backend mình sinh,
 * không phải input người dùng (style user đã bị sanitize strip trước đó).
 */
export function rehypeEnrichImages(meta?: Record<string, ImageMeta> | null) {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "img") return;
      node.properties ??= {};
      node.properties.loading = "lazy";
      node.properties.decoding = "async";

      const src = typeof node.properties.src === "string" ? node.properties.src : "";
      const m = meta?.[src];
      if (!m) return;
      node.properties.width = m.w;
      node.properties.height = m.h;
      node.properties.style = `background:url('${m.ph}') center / cover no-repeat`;
    });
  };
}
