import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthContext, type AuthStatus, type AuthContextValue } from "./context";
import { ProtectedRoute } from "./ProtectedRoute";

function renderAt(status: AuthStatus) {
  const value: AuthContextValue = {
    status,
    user: status === "authenticated" ? { email: "a@x.com" } : null,
    refresh: vi.fn(),
    signOut: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>secret content</div>} />
          </Route>
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects guests to /login", () => {
    renderAt("guest");
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("renders protected content when authenticated", () => {
    renderAt("authenticated");
    expect(screen.getByText("secret content")).toBeInTheDocument();
  });

  it("shows a loading state while resolving", () => {
    renderAt("loading");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });
});
