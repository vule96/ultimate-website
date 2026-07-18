import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Post } from "@ultimate/types";
import { ToastProvider } from "@ultimate/ui";
import { ApiError } from "@/lib/apiClient";
import { PostFormPage } from "./PostFormPage";

// --- Mocks: router, editor (lazy), queries ---
const mocks = vi.hoisted(() => ({
  usePostQuery: vi.fn(),
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...rest }: { to: string; children?: unknown }) => (
    <a href={String(to)} {...rest}>
      {children as never}
    </a>
  ),
}));

vi.mock("@/features/editor/EditorSwitch", () => ({
  EditorSwitch: ({
    initialHtml,
    onChange,
  }: {
    initialHtml: string;
    onChange: (v: { html: string; json: unknown }) => void;
  }) => (
    <textarea
      data-testid="editor"
      defaultValue={initialHtml}
      onChange={(e) => onChange({ html: e.target.value, json: { text: e.target.value } })}
    />
  ),
}));

vi.mock("./queries", () => ({
  usePostQuery: (slug: string | undefined) => mocks.usePostQuery(slug),
  useCreatePost: () => ({ mutate: mocks.createMutate, isPending: false }),
  useUpdatePost: () => ({ mutate: mocks.updateMutate, isPending: false }),
}));

const basePost = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Bài gốc",
  slug: "bai-goc",
  content_json: { type: "doc" },
  content_html: "<p>Nội dung gốc</p>",
  excerpt: null,
  cover_image: null,
  status: "DRAFT",
  meta_title: null,
  meta_desc: null,
  published_at: null,
  version: 1,
  cover_blurhash: null,
  content_image_meta: null,
  views: 0,
  tags: [],
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
} as unknown as Post;

function renderPage() {
  return render(
    <ToastProvider>
      <PostFormPage slug="bai-goc" />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PostFormPage — hydrate & data-loss (A1, A4)", () => {
  it("prefill form từ post đã load", () => {
    mocks.usePostQuery.mockReturnValue({ data: basePost, isPending: false, isError: false });
    renderPage();
    expect(screen.getByPlaceholderText("Tiêu đề bài viết")).toHaveValue("Bài gốc");
    // Radix Select (status) phải hiện label của giá trị đã load. Regression React 19:
    // Select không cập nhật label khi value đổi sau mount → fix bằng key={field.value}.
    expect(screen.getByRole("combobox")).toHaveTextContent("Nháp");
  });

  it("background refetch (object mới) KHÔNG ghi đè nội dung user đang sửa", () => {
    mocks.usePostQuery.mockReturnValue({ data: basePost, isPending: false, isError: false });
    const view = renderPage();

    const title = screen.getByPlaceholderText("Tiêu đề bài viết");
    fireEvent.change(title, { target: { value: "User đang gõ dở" } });

    // Mô phỏng refetch: query trả về OBJECT MỚI (identity khác) với data server cũ.
    mocks.usePostQuery.mockReturnValue({
      data: { ...basePost, title: "Server ghi đè" } as unknown as Post,
      isPending: false,
      isError: false,
    });
    view.rerender(
      <ToastProvider>
        <PostFormPage slug="bai-goc" />
      </ToastProvider>,
    );

    expect(screen.getByPlaceholderText("Tiêu đề bài viết")).toHaveValue("User đang gõ dở");
  });

  it("submit gửi content_json MỚI NHẤT từ editor", async () => {
    mocks.usePostQuery.mockReturnValue({ data: basePost, isPending: false, isError: false });
    renderPage();

    fireEvent.change(screen.getByTestId("editor"), { target: { value: "<p>Mới</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled());
    const [vars] = mocks.updateMutate.mock.calls[0] as [
      { id: string; input: { content_json: unknown } },
    ];
    expect(vars.input.content_json).toEqual({ text: "<p>Mới</p>" });
  });
});

describe("PostFormPage — optimistic locking (M5)", () => {
  it("gửi version của bản đã load khi update", async () => {
    mocks.usePostQuery.mockReturnValue({
      data: { ...basePost, version: 3 } as unknown as Post,
      isPending: false,
      isError: false,
      refetch: mocks.refetch,
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled());
    const [vars] = mocks.updateMutate.mock.calls[0] as [{ id: string; input: { version?: number } }];
    expect(vars.input.version).toBe(3);
  });

  it("409 VERSION_CONFLICT → banner conflict + nút tải lại gọi refetch", async () => {
    mocks.usePostQuery.mockReturnValue({
      data: basePost,
      isPending: false,
      isError: false,
      refetch: mocks.refetch,
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled());

    // Mô phỏng server trả 409: gọi onError mà component truyền vào mutate.
    const [, opts] = mocks.updateMutate.mock.calls[0] as [
      unknown,
      { onError: (e: unknown) => void },
    ];
    opts.onError(new ApiError(409, "VERSION_CONFLICT", "post was modified by someone else"));

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Bài đã bị sửa ở nơi khác");

    fireEvent.click(screen.getByRole("button", { name: "Tải bản mới nhất" }));
    expect(mocks.refetch).toHaveBeenCalled();
  });
});
