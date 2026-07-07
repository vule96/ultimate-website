import { describe, it, expect } from "vitest";
import { EDITOR_KIND } from "./config";

describe("EDITOR_KIND", () => {
  it("defaults to tiptap when VITE_EDITOR is unset", () => {
    // Trong môi trường test, import.meta.env.VITE_EDITOR không đặt → tiptap.
    expect(EDITOR_KIND).toBe("tiptap");
  });
});
