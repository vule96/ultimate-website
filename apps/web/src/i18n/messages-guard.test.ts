import { describe, expect, it } from "vitest";
import vi from "../../messages/vi.json";
import en from "../../messages/en.json";
import { syncMessages, type Messages } from "./sync";

describe("messages en/vi đối xứng", () => {
  it("en.json đúng khung vi.json (chạy pnpm i18n:gen nếu fail)", () => {
    const { added, removed } = syncMessages(vi as Messages, en as Messages);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  it("en.json không còn __TODO__", () => {
    expect(JSON.stringify(en)).not.toContain("__TODO__");
  });
});
