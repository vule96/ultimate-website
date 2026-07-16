import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoverImage } from "./cover-image";

describe("CoverImage", () => {
  it("reserve chỗ bằng aspect wrapper (chống CLS) + render ảnh", () => {
    const { container } = render(
      <CoverImage src="https://picsum.photos/1200/675" alt="Ảnh bìa" hash={null} priority />,
    );
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("aspect-");
    expect(wrapper?.className).toContain("relative");
    expect(screen.getByAltText("Ảnh bìa")).toBeInTheDocument();
  });

  it("có blurhash → render canvas placeholder", () => {
    const { container } = render(
      <CoverImage src="https://picsum.photos/1200/675" alt="x" hash="LKO2?U%2Tw=w]~RBVZRi};RPxuwH" />,
    );
    expect(container.querySelector("canvas")).not.toBeNull();
  });
});
