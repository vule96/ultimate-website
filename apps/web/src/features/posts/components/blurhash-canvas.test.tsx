import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { BlurhashCanvas } from "./blurhash-canvas";

vi.mock("blurhash", () => ({
  decode: vi.fn(() => new Uint8ClampedArray(32 * 32 * 4)),
}));

describe("BlurhashCanvas", () => {
  it("render canvas aria-hidden khi có hash", () => {
    const { container } = render(<BlurhashCanvas hash="LKO2?U%2Tw=w]~RBVZRi};RPxuwH" />);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveAttribute("aria-hidden", "true");
  });

  it("không render gì khi hash null", () => {
    const { container } = render(<BlurhashCanvas hash={null} />);
    expect(container.querySelector("canvas")).toBeNull();
  });
});
