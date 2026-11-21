import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { BannerAdmin } from "@/components/admin/banner-admin";
import { makeBanner } from "../fixtures";
import { mockFetch, sentBody, sentMethod } from "../helpers";

const sale = makeBanner();
const paused = makeBanner({ id: "64b7f0c2a1b2c3d4e5f60102", title: "Festive bundle", active: false });

describe("<BannerAdmin />", () => {
  it("lists banners with their on/off state", () => {
    render(<BannerAdmin initial={[sale, paused]} />);
    expect(screen.getByRole("switch", { name: /Hide Festive suit sale/ })).toBeChecked();
    expect(screen.getByRole("switch", { name: /Show Festive bundle/ })).not.toBeChecked();
  });

  it("shows an empty state with no banners", () => {
    render(<BannerAdmin initial={[]} />);
    expect(screen.getByText("No banners yet")).toBeInTheDocument();
  });

  it("toggling sends only { active } and updates immediately", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<BannerAdmin initial={[sale]} />);
    await user.click(screen.getByRole("switch", { name: /Hide Festive suit sale/ }));
    expect(screen.getByRole("switch", { name: /Show Festive suit sale/ })).not.toBeChecked();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/admin/banners/${sale.id}`);
    expect(sentMethod(fetchMock)).toBe("PUT");
    expect(sentBody(fetchMock)).toEqual({ active: false });
    expect(toast.success).toHaveBeenCalledWith("Banner hidden from website");
  });

  it("rolls the toggle back if the server rejects it", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ status: 500, body: { error: "Nope" } }));
    render(<BannerAdmin initial={[sale]} />);
    await user.click(screen.getByRole("switch", { name: /Hide Festive suit sale/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not update banner", { description: "Nope" }));
    expect(screen.getByRole("switch", { name: /Hide Festive suit sale/ })).toBeChecked();
  });

  it("creates a banner via POST", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({ status: 201, body: { id: "64b7f0c2a1b2c3d4e5f60999" } }));
    render(<BannerAdmin initial={[]} />);
    await user.click(screen.getAllByRole("button", { name: /Add banner/ })[0]);
    const form = screen.getByRole("dialog", { name: "Add banner" });
    await user.type(within(form).getByLabelText("Headline"), "Diwali dhamaka sale");
    await user.type(within(form).getByLabelText("Supporting text"), "Extra 10% off on sarees");
    await user.click(within(form).getByRole("button", { name: "Add banner" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/banners");
    expect(sentBody(fetchMock)).toMatchObject({ title: "Diwali dhamaka sale", cta: "Shop now", href: "/shop", theme: "blue", active: true });
    expect((await screen.findAllByText("Diwali dhamaka sale")).length).toBeGreaterThan(0);
  });

  it("rejects a button link that is neither a path nor a URL", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<BannerAdmin initial={[sale]} />);
    await user.click(screen.getByRole("button", { name: "Edit Festive suit sale" }));
    const form = screen.getByRole("dialog", { name: "Edit banner" });
    const link = within(form).getByLabelText("Button link");
    await user.clear(link);
    await user.type(link, "shop");
    await user.click(within(form).getByRole("button", { name: "Save changes" }));
    expect(await within(form).findByText(/Use a page path/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes after confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<BannerAdmin initial={[sale, paused]} />);
    await user.click(screen.getByRole("button", { name: "Delete Festive suit sale" }));
    await user.click(screen.getByRole("button", { name: "Delete banner" }));
    await waitFor(() => expect(screen.queryAllByText("Festive suit sale")).toHaveLength(0));
    expect(fetchMock).toHaveBeenCalledWith(`/api/admin/banners/${sale.id}`, expect.objectContaining({ method: "DELETE" }));
    expect(screen.getAllByText("Festive bundle").length).toBeGreaterThan(0);
  });
});