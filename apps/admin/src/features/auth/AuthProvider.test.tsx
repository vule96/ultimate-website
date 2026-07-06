import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./context";
import * as api from "./api";
import { ApiError } from "@/lib/apiClient";

vi.mock("./api");

function Probe() {
  const { status, user } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? "-"}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => vi.resetAllMocks());

  it("becomes authenticated when /auth/me succeeds", async () => {
    vi.mocked(api.fetchMe).mockResolvedValue({ email: "admin@x.com" });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("email")).toHaveTextContent("admin@x.com");
  });

  it("becomes guest when /auth/me returns 401", async () => {
    vi.mocked(api.fetchMe).mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "no"));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("guest"));
  });
});
