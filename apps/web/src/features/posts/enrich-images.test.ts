import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";
import type { ImageMeta } from "@ultimate/types";

const META: Record<string, ImageMeta> = {
  "https://cdn.x/a.png": { w: 1200, h: 630, ph: "data:image/png;base64,AAAA" },
};

describe("rehypeEnrichImages (qua sanitizeHtml)", () => {
  it("img khớp meta → width/height + background placeholder + lazy", async () => {
    const out = await sanitizeHtml(`<p>x</p><img src="https://cdn.x/a.png">`, META);
    expect(out).toContain('width="1200"');
    expect(out).toContain('height="630"');
    expect(out).toContain("data:image/png;base64,AAAA");
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('decoding="async"');
  });

  it("img không meta → chỉ lazy/async, không style", async () => {
    const out = await sanitizeHtml(`<img src="https://cdn.x/khac.png">`, META);
    expect(out).toContain('loading="lazy"');
    expect(out).not.toContain("background");
  });

  it("style do user nhét vào bị sanitize strip, style của plugin vẫn có", async () => {
    const out = await sanitizeHtml(
      `<img src="https://cdn.x/a.png" style="position:fixed" onerror="alert(1)">`,
      META,
    );
    expect(out).not.toContain("position:fixed");
    expect(out).not.toContain("onerror");
    expect(out).toContain("data:image/png;base64,AAAA");
  });

  it("không truyền meta → hành vi cũ + lazy", async () => {
    const out = await sanitizeHtml(`<img src="https://cdn.x/a.png">`);
    expect(out).toContain('loading="lazy"');
    expect(out).not.toContain("width=");
  });
});
