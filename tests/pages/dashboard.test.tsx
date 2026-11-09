import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeEnquiry, makeProduct } from "../fixtures";

vi.mock("@/lib/repo", () => ({ getDashboard: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));

import { getDashboard } from "@/lib/repo";
import { getSession } from "@/lib/auth";
import DashboardPage from "@/app/admin/(panel)/page";
import PanelLayout from "@/app/admin/(panel)/layout";
import LoginRedirect from "@/app/admin/login/page";

describe("Dashboard page (server component)", () => {
  it("shows live totals, most viewed product and recent enquiries", async () => {
    vi.mocked(getDashboard).mockResolvedValue({
      shop: { revenue: 125000, ordersThisMonth: 4, toProcess: 2, activeCarts: 3, customers: 9, lowStock: 1 },
      laptops: 12, accessories: 8, thisMonth: 5, fresh: 2, weekly: [1, 0, 3, 2, 4, 1, 5],
      top: [makeProduct({ name: "MacBook Air M1", views: 1320 }), makeProduct({ id: "2", name: "Dell Latitude", views: 800 })],
      recent: [makeEnquiry({ name: "Priya Singh", message: "Bulk pricing for 10 laptops?" })],
    });
    render(await DashboardPage());
    expect(screen.getByText("20")).toBeInTheDocument(); // 12 + 8
    expect(screen.getByText("12 clothing, 8 accessories")).toBeInTheDocument();
    expect(screen.getByText("2 waiting for a reply")).toBeInTheDocument();
    expect(screen.getAllByText("MacBook Air M1").length).toBeGreaterThan(0);
    expect(screen.getByText("1,320 views")).toBeInTheDocument();
    expect(screen.getByText("Priya Singh")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /1, 0, 3, 2, 4, 1, 5/ })).toBeInTheDocument();
  });

  it("shows shop numbers: revenue, orders to process, active carts and a low-stock warning", async () => {
    vi.mocked(getDashboard).mockResolvedValue({
      shop: { revenue: 125000, ordersThisMonth: 4, toProcess: 2, activeCarts: 3, customers: 9, lowStock: 2 },
      laptops: 1, accessories: 1, thisMonth: 0, fresh: 0, weekly: [0, 0, 0, 0, 0, 0, 0], top: [], recent: [],
    });
    render(await DashboardPage());
    expect(screen.getByText("₹1,25,000")).toBeInTheDocument();
    expect(screen.getByText("4 orders")).toBeInTheDocument();
    expect(screen.getByText("Orders to process").closest("a")).toHaveAttribute("href", "/admin/orders");
    expect(screen.getByText("Active carts").closest("a")).toHaveAttribute("href", "/admin/carts");
    expect(screen.getByText("9 customers")).toBeInTheDocument();
    expect(screen.getByText(/2 products are running low/)).toBeInTheDocument();
  });

  it("handles a brand-new store with no data", async () => {
    vi.mocked(getDashboard).mockResolvedValue({ shop: { revenue: 0, ordersThisMonth: 0, toProcess: 0, activeCarts: 0, customers: 0, lowStock: 0 }, laptops: 0, accessories: 0, thisMonth: 0, fresh: 0, weekly: [0, 0, 0, 0, 0, 0, 0], top: [], recent: [] });
    render(await DashboardPage());
    expect(screen.getByText("No views yet")).toBeInTheDocument();
    expect(screen.getByText(/No enquiries yet/)).toBeInTheDocument();
    expect(screen.getByText("Add products to see them here.")).toBeInTheDocument();
  });
});

describe("Admin route protection (server side)", () => {
  it("panel layout redirects signed-out visitors to the dashboard login page", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(PanelLayout({ children: <p>secret</p> })).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("panel layout renders the dashboard shell for a signed-in admin", async () => {
    vi.mocked(getSession).mockResolvedValue({ id: "a1", email: "owner@shop.com", name: "Store owner" });
    render(await PanelLayout({ children: <p>Admin content</p> }));
    expect(screen.getByText("Admin content")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(within(screen.getByRole("menu")).getByText("owner@shop.com")).toBeInTheDocument();
  });

  it("the old /admin/login URL sends visitors to /login", () => {
    expect(() => LoginRedirect()).toThrow("NEXT_REDIRECT:/login");
  });
});
