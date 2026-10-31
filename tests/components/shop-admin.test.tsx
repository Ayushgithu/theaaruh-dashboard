import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { OrdersAdmin } from "@/components/admin/orders-admin";
import { CartsAdmin } from "@/components/admin/carts-admin";
import { CustomersAdmin } from "@/components/admin/customers-admin";
import type { AdminCart, Customer } from "@/lib/types";
import { makeOrder } from "../fixtures";
import { mockFetch, sentBody, sentMethod } from "../helpers";

const cod = makeOrder({ id: "a".repeat(24), orderNumber: "LC-COD-1", status: "placed", payment: { method: "cod", status: "pending" }, customer: { name: "Priya Singh", email: "priya@x.com", phone: "9811120002" } });
const paid = makeOrder({ id: "b".repeat(24), orderNumber: "LC-PAID-2" });
const shipped = makeOrder({ id: "c".repeat(24), orderNumber: "LC-SHIP-3", status: "shipped", tracking: { carrier: "Delhivery", number: "DLV999" } });
const unpaid = makeOrder({ id: "d".repeat(24), orderNumber: "LC-UNPAID-4", status: "pending_payment", payment: { method: "razorpay", status: "pending" } });
const cancelled = makeOrder({ id: "e".repeat(24), orderNumber: "LC-CANC-5", status: "cancelled", payment: { method: "razorpay", status: "refunded", razorpayPaymentId: "pay_9", refundId: "rfnd_1" } });
const all = [cod, paid, shipped, unpaid, cancelled];

const table = () => within(screen.getByRole("table"));
const openOrder = async (user: ReturnType<typeof userEvent.setup>, number: string) => {
  await user.click(table().getByText(number));
  return screen.getByRole("dialog", { name: `Order ${number}` });
};

describe("<OrdersAdmin />", () => {
  it("shows tab counts and filters by tab", async () => {
    const user = userEvent.setup();
    render(<OrdersAdmin initial={all} />);
    expect(screen.getByRole("tab", { name: /^All 5/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^To process 2/ })).toBeInTheDocument(); // placed + confirmed
    expect(screen.getByRole("tab", { name: /^Awaiting payment 1/ })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^Shipped/ }));
    expect(table().getByText("LC-SHIP-3")).toBeInTheDocument();
    expect(table().queryByText("LC-COD-1")).not.toBeInTheDocument();
  });

  it("searches by order number, name or phone", async () => {
    const user = userEvent.setup();
    render(<OrdersAdmin initial={all} />);
    await user.type(screen.getByLabelText("Search orders"), "priya");
    expect(table().getByText("LC-COD-1")).toBeInTheDocument();
    expect(table().queryByText("LC-PAID-2")).not.toBeInTheDocument();
  });

  it("friendly empty states", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<OrdersAdmin initial={[]} />);
    expect(screen.getByText("No orders yet")).toBeInTheDocument();
    unmount();
    render(<OrdersAdmin initial={all} />);
    await user.type(screen.getByLabelText("Search orders"), "nothing-matches");
    expect(screen.getByText("No orders here")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show all orders" }));
    expect(table().getByText("LC-PAID-2")).toBeInTheDocument();
  });

  it("opens the order with customer, address, items, totals and WhatsApp / call links", async () => {
    const user = userEvent.setup();
    render(<OrdersAdmin initial={all} />);
    const d = await openOrder(user, "LC-COD-1");
    expect(within(d).getByText("Priya Singh")).toBeInTheDocument();
    expect(within(d).getByText("Dell Latitude 5420")).toBeInTheDocument();
    expect(within(d).getByText("411001", { exact: false })).toBeInTheDocument();
    expect(within(d).getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", expect.stringContaining("https://wa.me/919811120002"));
    expect(within(d).getByRole("link", { name: /Call/ })).toHaveAttribute("href", "tel:+919811120002");
  });

  it("confirms a Cash on Delivery order through the API and updates the badge", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({ body: { order: { ...cod, status: "confirmed" } } }));
    render(<OrdersAdmin initial={all} />);
    const d = await openOrder(user, "LC-COD-1");
    await user.click(within(d).getByRole("button", { name: "Confirm order" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: /^To process 2/ })).toBeInTheDocument());
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/admin/orders/${cod.id}`);
    expect(sentMethod(fetchMock)).toBe("PATCH");
    expect(sentBody(fetchMock)).toEqual({ status: "confirmed" });
  });

  it("shipping asks for courier + tracking number and sends both", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({ body: { order: { ...paid, status: "shipped", tracking: { carrier: "Delhivery", number: "DLV123" } } } }));
    render(<OrdersAdmin initial={all} />);
    const d = await openOrder(user, "LC-PAID-2");
    await user.click(within(d).getByRole("button", { name: "Mark as shipped" }));
    await user.type(within(d).getByLabelText("Courier name"), "Delhivery");
    await user.type(within(d).getByLabelText("Tracking number"), "DLV123");
    await user.click(within(d).getByRole("button", { name: "Save & notify customer" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock)).toEqual({ status: "shipped", carrier: "Delhivery", trackingNumber: "DLV123" });
    expect(toast.success).toHaveBeenCalled();
  });

  it("cancelling a paid online order says it will refund, and only does so after confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({ body: { order: { ...paid, status: "cancelled", payment: { ...paid.payment, status: "refunded", refundId: "rfnd_9" } } } }));
    render(<OrdersAdmin initial={all} />);
    const d = await openOrder(user, "LC-PAID-2");
    await user.click(within(d).getByRole("button", { name: /Cancel order & refund/ }));
    expect(within(d).getByText(/Cancel and refund ₹32,999 to the customer via Razorpay/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.type(within(d).getByLabelText("Cancellation reason"), "Out of stock");
    await user.click(within(d).getByRole("button", { name: "Yes, cancel order" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock)).toEqual({ status: "cancelled", note: "Out of stock" });
  });

  it("shows the server's message when a refund fails (order stays as it was)", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ status: 502, body: { error: "The refund could not be processed (Insufficient balance). The order was not cancelled." } }));
    render(<OrdersAdmin initial={all} />);
    const d = await openOrder(user, "LC-PAID-2");
    await user.click(within(d).getByRole("button", { name: /Cancel order & refund/ }));
    await user.click(within(d).getByRole("button", { name: "Yes, cancel order" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ description: expect.stringContaining("Insufficient balance") })));
    expect(screen.getByRole("tab", { name: /^Cancelled 1/ })).toBeInTheDocument();
  });

  it("final orders offer no further actions", async () => {
    const user = userEvent.setup();
    render(<OrdersAdmin initial={all} />);
    const d = await openOrder(user, "LC-CANC-5");
    expect(within(d).getByText(/No further changes/)).toBeInTheDocument();
    expect(within(d).queryByRole("button", { name: /Cancel order/ })).not.toBeInTheDocument();
    expect(within(d).getByText(/rfnd_1/)).toBeInTheDocument();
  });
});

const cart = (over: Partial<AdminCart> = {}): AdminCart => ({
  userId: "u1", customer: { name: "Ravi Kumar", email: "ravi@x.com", phone: "9876543210" },
  items: [{ productId: "p1", slug: "dell", name: "Dell Latitude 5420", brand: "Dell", price: 32999, quantity: 1, addedAt: new Date().toISOString(), art: { kind: "laptop", tone: "silver", hue: 200 }, available: 3 }],
  total: 32999, updatedAt: new Date().toISOString(), ...over,
});

describe("<CartsAdmin /> (who added what)", () => {
  it("shows each customer with their items, quantities, totals and when they added them", () => {
    render(<CartsAdmin initial={[cart(), cart({ userId: "u2", customer: { name: "Priya Singh", email: "priya@x.com", phone: "9811120002" }, total: 599, items: [{ ...cart().items[0], productId: "p2", name: "Logitech Mouse", price: 599, quantity: 2 }] })]} />);
    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText("Dell Latitude 5420")).toBeInTheDocument();
    expect(screen.getByText("Priya Singh")).toBeInTheDocument();
    expect(screen.getByText("Logitech Mouse")).toBeInTheDocument();
    expect(screen.getAllByText(/added/).length).toBeGreaterThan(1);
    expect(screen.getByText("₹32,999", { selector: "p.text-lg" })).toBeInTheDocument();
  });

  it("offers a WhatsApp reminder with the customer's items in the message, and a call link", () => {
    render(<CartsAdmin initial={[cart()]} />);
    const wa = screen.getByRole("link", { name: /WhatsApp|Remind/i });
    expect(wa.getAttribute("href")).toContain("https://wa.me/919876543210?text=");
    expect(decodeURIComponent(wa.getAttribute("href")!)).toContain("Dell Latitude 5420");
    expect(screen.getByRole("link", { name: /Call/ })).toHaveAttribute("href", "tel:+919876543210");
  });

  it("flags items that sold out since they were added", () => {
    render(<CartsAdmin initial={[cart({ items: [{ ...cart().items[0], available: 0 }] })]} />);
    expect(screen.getByText(/sold out/)).toBeInTheDocument();
  });

  it("searches by customer or product", async () => {
    const user = userEvent.setup();
    render(<CartsAdmin initial={[cart(), cart({ userId: "u2", customer: { name: "Priya Singh", email: "p@x.com", phone: "9811120002" } })]} />);
    await user.type(screen.getByLabelText("Search carts"), "priya");
    expect(screen.queryByText("Ravi Kumar")).not.toBeInTheDocument();
    expect(screen.getByText("Priya Singh")).toBeInTheDocument();
  });

  describe("full customer details", () => {
    const member = () => cart({ updatedAt: new Date(Date.now() - 30 * 3600_000).toISOString(), customer: { name: "Ravi Kumar", email: "ravi@x.com", phone: "9876543210", guest: false, joined: "2026-01-05T00:00:00.000Z", wallet: 250, orders: 3, spent: 7800, lastOrderAt: new Date(Date.now() - 5 * 86400000).toISOString(), address: { name: "Ravi", line1: "12 MG Road", city: "Pune", state: "Maharashtra", pincode: "411001" } } });
    const guest = () => cart({ userId: "g1", customer: { name: "Guest", email: "guest-1@guest.invalid", phone: "", guest: true }, updatedAt: new Date().toISOString() });

    it("shows purchase history, wallet, address and how long ago they left", () => {
      render(<CartsAdmin initial={[member()]} />);
      expect(screen.getByText(/Returning · 3 orders/)).toBeInTheDocument();
      expect(screen.getByText(/3 orders · ₹7,800/)).toBeInTheDocument();
      expect(screen.getByText("₹250")).toBeInTheDocument();
      expect(screen.getByText(/12 MG Road, Pune, Maharashtra, 411001/)).toBeInTheDocument();
      expect(screen.getByText(/Abandoned · last activity/)).toBeInTheDocument();
    });
    it("guests have no contact buttons and say why", () => {
      render(<CartsAdmin initial={[guest()]} />);
      expect(screen.getByText("Guest visitor")).toBeInTheDocument();
      expect(screen.getByText(/No contact details yet/)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Call/ })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Copy details/ })).toBeInTheDocument();
    });
    it("filters by how long ago they left, and members vs guests", async () => {
      const user = userEvent.setup();
      render(<CartsAdmin initial={[member(), guest()]} />);
      await user.click(screen.getByRole("tab", { name: /Left 24h\+ ago/ }));
      expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
      expect(screen.queryByText("Guest visitor")).not.toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: /Guests/ }));
      expect(screen.getByText("Guest visitor")).toBeInTheDocument();
      expect(screen.queryByText("Ravi Kumar")).not.toBeInTheDocument();
    });
    it("counts the carts worth a reminder (signed in, has a phone, idle 1h+)", () => {
      render(<CartsAdmin initial={[member(), guest()]} />);
      expect(screen.getByText("Worth a reminder").nextElementSibling).toHaveTextContent("1");
    });
    it("sorts by highest value", async () => {
      const user = userEvent.setup();
      render(<CartsAdmin initial={[cart({ userId: "a", total: 500, customer: { name: "Low Buyer", email: "l@x.com", phone: "9000000001" } }), cart({ userId: "b", total: 9000, customer: { name: "High Buyer", email: "h@x.com", phone: "9000000002" } })]} />);
      await user.selectOptions(screen.getByLabelText("Sort carts"), "value");
      const names = screen.getAllByText(/Low Buyer|High Buyer/).map((n) => n.textContent);
      expect(names[0]).toContain("High Buyer");
    });
  });

  it("empty state when nobody has anything in their cart", () => {
    render(<CartsAdmin initial={[]} />);
    expect(screen.getByText("No active carts")).toBeInTheDocument();
  });
});

const cust = (over: Partial<Customer> = {}): Customer => ({ id: "c1", name: "Ravi Kumar", email: "ravi@x.com", phone: "9876543210", createdAt: "2026-09-01T00:00:00.000Z", wallet: 0, orders: 2, spent: 45000, carts: 0, ...over });

describe("<CustomersAdmin />", () => {
  it("lists customers with orders and spend", () => {
    render(<CustomersAdmin initial={[cust(), cust({ id: "c2", name: "Priya Singh", email: "priya@x.com", orders: 0, spent: 0 })]} />);
    expect(screen.getAllByText("Ravi Kumar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("₹45,000").length).toBeGreaterThan(0);
    expect(screen.getByText("2 registered customers")).toBeInTheDocument();
  });
  it("searches and has an empty state", async () => {
    const user = userEvent.setup();
    render(<CustomersAdmin initial={[cust(), cust({ id: "c2", name: "Priya Singh", email: "priya@x.com" })]} />);
    await user.type(screen.getByLabelText("Search customers"), "zzz");
    expect(screen.getByText("Nothing matches your search")).toBeInTheDocument();
  });
  it("no customers yet", () => {
    render(<CustomersAdmin initial={[]} />);
    expect(screen.getByText("No customers yet")).toBeInTheDocument();
  });
});

describe("dialogs keep focus while typing (regression)", () => {
  it("typing a long note in an order dialog does not lose focus after the first letter", async () => {
    const user = userEvent.setup();
    render(<OrdersAdmin initial={[paid]} />);
    await user.click(within(screen.getByRole("table")).getByText("LC-PAID-2"));
    const d = screen.getByRole("dialog", { name: "Order LC-PAID-2" });
    await user.click(within(d).getByRole("button", { name: /Cancel order & refund/ }));
    const reason = within(d).getByLabelText("Cancellation reason");
    await user.type(reason, "Customer changed mind");
    expect(reason).toHaveValue("Customer changed mind");
  });
});
