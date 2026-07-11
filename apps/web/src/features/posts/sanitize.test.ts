import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("loại thẻ script", async () => {
    const out = await sanitizeHtml("<p>ok</p><script>alert(1)</script>");
    expect(out).toContain("<p>ok</p>");
    expect(out).not.toContain("<script");
  });
  it("loại on* handler", async () => {
    const out = await sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
  });
  it("loại javascript: href", async () => {
    const out = await sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });
  it("giữ table, mark, task-list checkbox", async () => {
    const html =
      '<table><tr><td>c</td></tr></table><mark>hi</mark><input type="checkbox" checked disabled>';
    const out = await sanitizeHtml(html);
    expect(out).toContain("<table");
    expect(out).toContain("<mark>");
    expect(out).toContain('type="checkbox"');
  });
  it("giữ link http", async () => {
    const out = await sanitizeHtml('<a href="https://x.test">x</a>');
    expect(out).toContain('href="https://x.test"');
  });
});
