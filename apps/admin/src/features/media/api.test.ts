import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadImage } from "./api";
import { ApiError } from "@/lib/apiClient";

function fakeFile(type: string, size: number, name = "a.png"): File {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("uploadImage", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("rejects unsupported type before any request", async () => {
    await expect(uploadImage(fakeFile("application/pdf", 100))).rejects.toBeInstanceOf(ApiError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects oversized file", async () => {
    await expect(uploadImage(fakeFile("image/png", 6 * 1024 * 1024))).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("presigns then PUTs and returns public_url", async () => {
    const f = vi.mocked(fetch);
    f.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "",
      json: async () => ({
        upload_url: "https://storage.test/put?sig=x",
        public_url: "https://cdn.test/uploads/a.png",
        key: "uploads/a.png",
        expires_in: 900,
      }),
    } as Response);
    f.mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const url = await uploadImage(fakeFile("image/png", 1024));
    expect(url).toBe("https://cdn.test/uploads/a.png");

    // Lần 2 là PUT thẳng lên presigned URL.
    const putCall = f.mock.calls[1];
    expect(putCall?.[0]).toBe("https://storage.test/put?sig=x");
    expect((putCall?.[1] as RequestInit).method).toBe("PUT");
  });

  it("throws when storage PUT fails", async () => {
    const f = vi.mocked(fetch);
    f.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "",
      json: async () => ({
        upload_url: "https://storage.test/put",
        public_url: "https://cdn.test/x.png",
        key: "x.png",
        expires_in: 900,
      }),
    } as Response);
    f.mockResolvedValueOnce({ ok: false, status: 403 } as Response);

    await expect(uploadImage(fakeFile("image/png", 1024))).rejects.toBeInstanceOf(ApiError);
  });
});
