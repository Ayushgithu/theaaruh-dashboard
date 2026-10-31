import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { EnquiryAdmin } from "@/components/admin/enquiry-admin";
import { makeEnquiry } from "../fixtures";
import { mockFetch, sentBody, sentMethod } from "../helpers";

const items = [
  makeEnquiry(),
  makeEnquiry({ id: "64b7f0c2a1b2c3d4e5f60202", name: "Priya Singh", phone: "+91 98111 20002", source: "Contact form", message: "Bulk pricing for 10 laptops?", products: [], status: "contacted" }),
  makeEnquiry({
    id: "64b7f0c2a1b2c3d4e5f60203", name: "Karan Malhotra", source: "Sell request", message: "Selling a Dell XPS 13", products: [], status: "closed",
    sell: { brand: "Dell", model: "XPS 13", condition: "Good", expectedPrice: 38000, city: "Delhi", photos: ["/api/images/64b7f0c2a1b2c3d4e5f60777"] },
  }),
];
const table = () => within(screen.getByRole("table"));

describe("<EnquiryAdmin />", () => {
  it("shows tab counts per status", () => {
    render(<EnquiryAdmin initial={items} />);
    expect(screen.getByRole("tab", { name: /^all 3/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^new 1/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^contacted 1/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^closed 1/ })).toBeInTheDocument();
  });

  it("filters by status tab", async () => {
    const user = userEvent.setup();
    render(<EnquiryAdmin initial={items} />);
    await user.click(screen.getByRole("tab", { name: /^contacted/ }));
    expect(table().getByText("Priya Singh")).toBeInTheDocument();
    expect(table().queryByText("Aarav Mehta")).not.toBeInTheDocument();
  });

  it("searches name, phone and message", async () => {
    const user = userEvent.setup();
    render(<EnquiryAdmin initial={items} />);
    await user.type(screen.getByLabelText("Search enquiries"), "bulk pricing");
    expect(table().getByText("Priya Singh")).toBeInTheDocument();
    expect(table().queryByText("Karan Malhotra")).not.toBeInTheDocument();
  });

  it("shows an empty state and can reset the filters", async () => {
    const user = userEvent.setup();
    render(<EnquiryAdmin initial={items} />);
    await user.type(screen.getByLabelText("Search enquiries"), "nothing like this");
    expect(screen.getByText("No enquiries here")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show all enquiries" }));
    expect(table().getByText("Aarav Mehta")).toBeInTheDocument();
  });

  it("opens the details dialog with WhatsApp and call links", async () => {
    const user = userEvent.setup();
    render(<EnquiryAdmin initial={items} />);
    await user.click(table().getByText("Aarav Mehta"));
    const dialog = screen.getByRole("dialog", { name: "Enquiry details" });
    expect(within(dialog).getByText("Is the MacBook Air still available?")).toBeInTheDocument();
    expect(within(dialog).getByText("Apple MacBook Air M1")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Reply on WhatsApp/ })).toHaveAttribute("href", "https://wa.me/919811120001");
    expect(within(dialog).getByRole("link", { name: /Call/ })).toHaveAttribute("href", "tel:+919811120001");
  });

  it("shows sell-request details with expected price and photos", async () => {
    const user = userEvent.setup();
    render(<EnquiryAdmin initial={items} />);
    await user.click(table().getByText("Karan Malhotra"));
    const dialog = screen.getByRole("dialog", { name: "Enquiry details" });
    expect(within(dialog).getByText("Dell XPS 13")).toBeInTheDocument();
    expect(within(dialog).getByText("₹38,000")).toBeInTheDocument();
    expect(within(dialog).getByAltText("Photo 1")).toHaveAttribute("src", "/api/images/64b7f0c2a1b2c3d4e5f60777");
  });

  it("changes status through the API and updates the badge", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<EnquiryAdmin initial={items} />);
    await user.click(table().getByText("Aarav Mehta"));
    const dialog = screen.getByRole("dialog", { name: "Enquiry details" });
    await user.click(within(dialog).getByRole("button", { name: "contacted" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Status updated", { description: "Marked as contacted" }));
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/admin/enquiries/${items[0].id}`);
    expect(sentMethod(fetchMock)).toBe("PATCH");
    expect(sentBody(fetchMock)).toEqual({ status: "contacted" });
    expect(screen.getByRole("tab", { name: /^contacted 2/ })).toBeInTheDocument();
  });

  it("does not change status if the server fails", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ status: 500, body: { error: "Database is down" } }));
    render(<EnquiryAdmin initial={items} />);
    await user.click(table().getByText("Aarav Mehta"));
    await user.click(within(screen.getByRole("dialog", { name: "Enquiry details" })).getByRole("button", { name: "closed" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not update status", { description: "Database is down" }));
    expect(screen.getByRole("tab", { name: /^new 1/ })).toBeInTheDocument();
  });
});
