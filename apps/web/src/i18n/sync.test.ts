import { describe, expect, it } from "vitest";
import { syncMessages } from "./sync";

describe("syncMessages", () => {
  it("key thiếu → thêm __TODO__ kèm bản vi", () => {
    const { result, added } = syncMessages({ a: { b: "xin chào" } }, {});
    expect(result).toEqual({ a: { b: "__TODO__ xin chào" } });
    expect(added).toEqual(["a.b"]);
  });

  it("key thừa → xoá", () => {
    const { result, removed } = syncMessages({ a: "x" }, { a: "x-en", zombie: "old" });
    expect(result).toEqual({ a: "x-en" });
    expect(removed).toEqual(["zombie"]);
  });

  it("key đã dịch → giữ nguyên", () => {
    const { result } = syncMessages({ a: "vi" }, { a: "en" });
    expect(result).toEqual({ a: "en" });
  });

  it("thứ tự key theo vi.json", () => {
    const { result } = syncMessages({ b: "2", a: "1" }, { a: "one" });
    expect(Object.keys(result)).toEqual(["b", "a"]);
  });

  it("node lồng: en là string nhưng vi là object → thay bằng khung mới", () => {
    const { result } = syncMessages({ a: { b: "x" } }, { a: "flat" });
    expect(result).toEqual({ a: { b: "__TODO__ x" } });
  });
});
