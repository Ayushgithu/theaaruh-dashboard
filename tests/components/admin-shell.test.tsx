import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminShell } from "@/components/admin/shell";
import { router } from "../mocks";
import { mockFetch, routeFetch } from "../helpers";

beforeEach(() => Object.values(router).forEach((f) => f.mockClear()));

const admin = { name: "Store owner", email: "owner@shop.com" };

describe("<AdminShell />", () => {
  it("renders the sidebar links and the page content", () => {
    render(<AdminShell admin={admin}><p>Page body</p></AdminShell>);
    for (const name of ["Dashboard", "Orders", "Carts", "Customers", "Clothing", "Accessories", "Top bar", "Banners", "Enquiries", "Settings"]) {
      expect(screen.getAllByRole("link", { name })[0]).toBeInTheDocument();
    }
    expect(screen.getByText("Page body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
  });

  it("marks the current page (usePathname mocked as /admin)", () => {
    render(<AdminShell admin={admin}>x</AdminShell>);
    expect(screen.getAllByRole("link", { name: "Dashboard" })[0]).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { name: "Clothing" })[0]).not.toHaveAttribute("aria-current");
  });

  it("signs out through the API and returns to the login page", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<AdminShell admin={admin}>x</AdminShell>);
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/logout", expect.objectContaining({ method: "POST" }));
  });

  it("has a dark-mode toggle in the dashboard", () => {
    render(<AdminShell admin={admin}>x</AdminShell>);
    expect(screen.getAllByRole("button", { name: "Toggle dark mode" }).length).toBeGreaterThan(0);
  });

  it("opens the mobile menu drawer", async () => {
    const user = userEvent.setup();
    render(<AdminShell admin={admin}>x</AdminShell>);
    await user.click(screen.getByRole("button", { name: "Open admin menu" }));
    expect(screen.getByRole("dialog", { name: "Admin menu" })).toBeInTheDocument();
  });

  it("shows red counts on Orders, Carts and Enquiries for things not seen yet", async () => {
    localStorage.clear();
    ["orders", "carts", "enquiries"].forEach((k) => localStorage.setItem(`lc_admin_seen_${k}`, "1000")); // already visited once
    routeFetch({
      "GET /api/admin/badges": () => ({ body: { now: Date.now(), counts: { orders: 3, carts: 1, enquiries: 120 } } }),
      "GET /api/admin/notifications": () => ({ body: { items: [] } }),
    });
    render(<AdminShell admin={admin}>x</AdminShell>);
    expect(await screen.findByLabelText("3 new")).toHaveTextContent("3");
    expect(screen.getByLabelText("1 new")).toBeInTheDocument();
    expect(screen.getByLabelText("120 new")).toHaveTextContent("99+");
  });

  it("shows no dots when nothing new has arrived", async () => {
    localStorage.clear();
    ["orders", "carts", "enquiries"].forEach((k) => localStorage.setItem(`lc_admin_seen_${k}`, "1000"));
    const fetchMock = routeFetch({
      "GET /api/admin/badges": () => ({ body: { now: Date.now(), counts: { orders: 0, carts: 0, enquiries: 0 } } }),
      "GET /api/admin/notifications": () => ({ body: { items: [] } }),
    });
    render(<AdminShell admin={admin}>x</AdminShell>);
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).startsWith("/api/admin/badges"))).toBe(true));
    expect(screen.queryByLabelText(/ new$/)).not.toBeInTheDocument();
  });

  it("shows the signed-in admin top right and can sign out from there", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<AdminShell admin={admin}>x</AdminShell>);
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Store owner")).toBeInTheDocument();
    expect(within(menu).getByText("owner@shop.com")).toBeInTheDocument();
    await user.click(within(menu).getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/logout", expect.objectContaining({ method: "POST" }));
  });
});
