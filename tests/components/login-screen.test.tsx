import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminLoginScreen } from "@/components/admin/login-screen";
import { router } from "../mocks";
import { mockFetch, sentBody } from "../helpers";

beforeEach(() => {
  Object.values(router).forEach((f) => f.mockClear());
  window.history.replaceState(null, "", "/login");
});

describe("<AdminLoginScreen /> (dashboard /login page)", () => {
  it("shows the sign-in form as a normal page", () => {
    render(<AdminLoginScreen />);
    expect(screen.getByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("validates empty fields without calling the server", async () => {
    const fetchMock = mockFetch(() => ({}));
    render(<AdminLoginScreen />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs in and opens /admin", async () => {
    const fetchMock = mockFetch(() => ({ body: { ok: true } }));
    const user = userEvent.setup();
    render(<AdminLoginScreen />);
    await user.type(screen.getByLabelText("Email"), "admin@shop.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/login");
    expect(sentBody(fetchMock)).toEqual({ email: "admin@shop.com", password: "secret123" });
  });

  it("shows the server message for wrong credentials", async () => {
    mockFetch(() => ({ status: 401, body: { error: "Incorrect email or password." } }));
    const user = userEvent.setup();
    render(<AdminLoginScreen />);
    await user.type(screen.getByLabelText("Email"), "admin@shop.com");
    await user.type(screen.getByLabelText("Password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens the reset form from the emailed link and removes the token from the address bar", async () => {
    const token = "a".repeat(64);
    window.history.replaceState(null, "", `/login?mode=reset&token=${token}&email=admin%40shop.com`);
    const fetchMock = mockFetch(() => ({ body: { ok: true } }));
    const user = userEvent.setup();
    render(<AdminLoginScreen />);
    expect(await screen.findByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
    expect(window.location.search).toBe("");
    await user.type(screen.getByLabelText("New password"), "brand-new-pass");
    await user.type(screen.getByLabelText("Confirm new password"), "brand-new-pass");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/reset-password"));
    expect(sentBody(fetchMock)).toEqual({ email: "admin@shop.com", token, password: "brand-new-pass" });
    expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });
});
