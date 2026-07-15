import { describe, it, expect } from "vitest";
import { formatViews, formatDate, readMinutesFromHtml } from "./format";

describe("formatViews", () => {
  it("giữ nguyên số nhỏ", () => expect(formatViews(950)).toBe("950"));
  it("rút gọn nghìn", () => expect(formatViews(11000)).toBe("11k"));
  it("nghìn lẻ có 1 chữ số thập phân", () => expect(formatViews(11500)).toBe("11.5k"));
  it("rút gọn triệu", () => expect(formatViews(1_200_000)).toBe("1.2m"));
});

describe("formatDate", () => {
  it("ISO → dd/mm/yyyy", () => expect(formatDate("2026-07-12T10:00:00Z")).toBe("12/07/2026"));
});

describe("readMinutesFromHtml", () => {
  it("đếm từ / 200 wpm, tối thiểu 1", () => {
    expect(readMinutesFromHtml("<p>một hai ba</p>")).toBe(1);
  });
  it("400 từ ≈ 2 phút", () => {
    const html = "<p>" + Array(400).fill("từ").join(" ") + "</p>";
    expect(readMinutesFromHtml(html)).toBe(2);
  });
});
