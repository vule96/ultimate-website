import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSafe } from "./build-safe";

describe("buildSafe", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("trả kết quả khi fn thành công", async () => {
    await expect(buildSafe(async () => 42, 0)).resolves.toBe(42);
  });

  it("runtime (không set env) → rethrow, KHÔNG nuốt lỗi", async () => {
    await expect(buildSafe(async () => { throw new Error("down"); }, 0)).rejects.toThrow("down");
  });

  it("BUILD_WITHOUT_API=1 → trả fallback", async () => {
    vi.stubEnv("BUILD_WITHOUT_API", "1");
    await expect(buildSafe(async () => { throw new Error("down"); }, [])).resolves.toEqual([]);
  });
});
