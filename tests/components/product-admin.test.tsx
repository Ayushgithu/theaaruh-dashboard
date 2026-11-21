import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { ProductAdmin } from "@/components/admin/product-admin";
import { makeProduct } from "../fixtures";
import { mockFetch, sentBody, sentMethod } from "../helpers";

const suit = makeProduct({
  type: "clothing", name: "Maroon Anarkali Suit", brand: "", category: "Suit Sets", price: 2499, mrp: 3499, quantity: 8,
  art: { kind: "cloth", tone: "silver", hue: 340 }, sizes: [{ label: "S", qty: 0 }, { label: "M", qty: 2 }, { label: "L", qty: 6 }],
  colors: [{ name: "Maroon", hex: "#8c1d40" }], fabric: "Pure cotton", badges: ["Best Seller"],
});
const saree = makeProduct({ id: "64b7f0c2a1b2c3d4e5f60002", slug: "silk-saree", type: "clothing", name: "Silk Saree", brand: "", category: "Sarees", price: 4999, mrp: undefined, stock: "low", stockCount: 2, quantity: 2, art: { kind: "cloth", tone: "silver", hue: 20 }, sizes: [{ label: "Free Size", qty: 2 }], });

const table = () => screen.getByRole("table");
const openAdd = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getAllByRole("button", { name: "Add product" })[0]);
  return screen.getByRole("dialog", { name: "Add product" });
};

describe("<ProductAdmin /> list", () => {
  it("shows every product with collection, price, size-wise stock and status", () => {
    render(<ProductAdmin initial={[suit, saree]} />);
    const t = within(table());
    expect(t.getByText("Maroon Anarkali Suit")).toBeInTheDocument();
    expect(t.getByText("Suit Sets")).toBeInTheDocument();
    expect(t.getByText("₹2,499")).toBeInTheDocument();
    expect(t.getByText("S: 0")).toBeInTheDocument(); // sold-out size is visible at a glance
    expect(t.getByText("M: 2")).toBeInTheDocument();
    expect(t.getByText("Only 2 left")).toBeInTheDocument();
  });

  it("filters by search text and shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    render(<ProductAdmin initial={[suit, saree]} />);
    await user.type(screen.getByLabelText("Search products"), "saree");
    expect(within(table()).queryByText("Maroon Anarkali Suit")).not.toBeInTheDocument();
    expect(within(table()).getByText("Silk Saree")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search products"));
    await user.type(screen.getByLabelText("Search products"), "zzz");
    expect(screen.getByText("Nothing matches your search")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(table()).toBeInTheDocument();
  });

  it("shows a friendly empty state with an add button when there are no products", () => {
    render(<ProductAdmin initial={[]} />);
    expect(screen.getByText("No products yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /add product/i }).length).toBeGreaterThan(0);
  });
});

describe("<ProductAdmin /> delete", () => {
  it("asks for confirmation, calls the API and removes the row", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({ body: { ok: true } }));
    render(<ProductAdmin initial={[suit, saree]} />);
    await user.click(within(table()).getByRole("button", { name: "Delete Maroon Anarkali Suit" }));
    expect(screen.getByRole("dialog", { name: "Delete this product?" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete product" }));
    await waitFor(() => expect(within(table()).queryByText("Maroon Anarkali Suit")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(`/api/admin/products/${suit.id}`, expect.objectContaining({ method: "DELETE" }));
    expect(toast.success).toHaveBeenCalledWith("Product deleted", expect.anything());
  });

  it("cancel keeps the product", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<ProductAdmin initial={[suit]} />);
    await user.click(within(table()).getByRole("button", { name: "Delete Maroon Anarkali Suit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(table()).getByText("Maroon Anarkali Suit")).toBeInTheDocument();
  });

  it("keeps the row and shows an error when the server fails", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ status: 500, body: { error: "Database is down" } }));
    render(<ProductAdmin initial={[suit]} />);
    await user.click(within(table()).getByRole("button", { name: "Delete Maroon Anarkali Suit" }));
    await user.click(screen.getByRole("button", { name: "Delete product" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not delete", { description: "Database is down" }));
    expect(within(table()).getByText("Maroon Anarkali Suit")).toBeInTheDocument();
  });
});

describe("<ProductAdmin /> add & edit (clothing)", () => {
  it("validates before sending anything", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<ProductAdmin initial={[]} />);
    const form = await openAdd(user);
    await user.click(within(form).getByRole("button", { name: "Add product" }));
    expect(await screen.findByText("Enter the product name")).toBeInTheDocument();
    expect(screen.getByText("Enter a collection / category")).toBeInTheDocument();
    expect(screen.getByText("Enter the selling price in rupees")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a product with sizes, colours and tags and adds it to the list", async () => {
    const user = userEvent.setup();
    const created = makeProduct({ ...suit, id: "64b7f0c2a1b2c3d4e5f69999", name: "Green Palazzo Suit" });
    const fetchMock = mockFetch(() => ({ status: 201, body: created }));
    render(<ProductAdmin initial={[]} />);
    const form = await openAdd(user);
    await user.type(within(form).getByLabelText("Name"), "Green Palazzo Suit");
    await user.type(within(form).getByLabelText("Collection"), "Suit Sets");
    await user.type(within(form).getByLabelText("Selling price (₹)"), "2199");
    await user.type(within(form).getByLabelText("Original price / MRP (₹)"), "2999");
    await user.type(within(form).getByLabelText("Description"), "Soft georgette palazzo suit.");
    await user.click(within(form).getByRole("button", { name: "M", pressed: false }));
    await user.click(within(form).getByRole("button", { name: "L", pressed: false }));
    const mStock = within(form).getByLabelText("Stock for size M");
    await user.clear(mStock);
    await user.type(mStock, "3");
    await user.click(within(form).getByRole("button", { name: /Add colour/ }));
    await user.type(within(form).getByLabelText("Colour name"), "Bottle Green");
    await user.click(within(form).getByLabelText("New"));
    await user.click(within(form).getByRole("switch", { name: "Featured on home page" }));
    expect(within(form).getByText(/Total in stock:/)).toHaveTextContent("8"); // 3 + 5
    await user.click(within(form).getByRole("button", { name: "Add product" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/products");
    expect(sentMethod(fetchMock)).toBe("POST");
    expect(sentBody(fetchMock)).toMatchObject({
      type: "clothing", name: "Green Palazzo Suit", category: "Suit Sets", price: 2199, mrp: 2999, featured: true, badges: ["New"],
      sizes: [{ label: "M", qty: 3 }, { label: "L", qty: 5 }], colors: [{ name: "Bottle Green", hex: "#8c1d40" }],
    });
    expect(sentBody(fetchMock).units).toBeUndefined(); // with sizes, the total is their sum
    expect(await within(table()).findByText("Green Palazzo Suit")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Product added", expect.objectContaining({ description: expect.stringContaining("live on the website") }));
  });

  it("without sizes, units in stock is required", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<ProductAdmin initial={[]} />);
    const form = await openAdd(user);
    await user.type(within(form).getByLabelText("Name"), "Plain Dupatta Set");
    await user.type(within(form).getByLabelText("Collection"), "Suit Sets");
    await user.type(within(form).getByLabelText("Selling price (₹)"), "999");
    await user.type(within(form).getByLabelText("Description"), "A simple everyday set.");
    await user.clear(within(form).getByLabelText("Units in stock"));
    await user.click(within(form).getByRole("button", { name: "Add product" }));
    expect(await screen.findByText("Add sizes with stock, or enter the units in stock")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the form open and shows the server error if saving fails", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ status: 400, body: { error: "Enter a collection / category" } }));
    render(<ProductAdmin initial={[]} />);
    const form = await openAdd(user);
    await user.type(within(form).getByLabelText("Name"), "Some Suit Set");
    await user.type(within(form).getByLabelText("Collection"), "Suit Sets");
    await user.type(within(form).getByLabelText("Selling price (₹)"), "1000");
    await user.type(within(form).getByLabelText("Description"), "Long enough description.");
    await user.click(within(form).getByRole("button", { name: "Add product" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save", { description: "Enter a collection / category" }));
    expect(screen.getByRole("dialog", { name: "Add product" })).toBeInTheDocument();
  });

  it("edits an existing product with PUT, prefilled with its sizes", async () => {
    const user = userEvent.setup();
    const updated = { ...suit, price: 2299 };
    const fetchMock = mockFetch(() => ({ body: updated }));
    render(<ProductAdmin initial={[suit]} />);
    await user.click(within(table()).getByRole("button", { name: "Edit Maroon Anarkali Suit" }));
    const form = screen.getByRole("dialog", { name: "Edit product" });
    expect(within(form).getByLabelText("Name")).toHaveValue("Maroon Anarkali Suit");
    expect(within(form).getByLabelText("Stock for size L")).toHaveValue("6");
    expect(within(form).getByLabelText("Colour name")).toHaveValue("Maroon");
    const price = within(form).getByLabelText("Selling price (₹)");
    await user.clear(price);
    await user.type(price, "2299");
    await user.click(within(form).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(within(table()).getByText("₹2,299")).toBeInTheDocument());
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/admin/products/${suit.id}`);
    expect(sentMethod(fetchMock)).toBe("PUT");
    expect(sentBody(fetchMock).sizes).toEqual([{ label: "S", qty: 0 }, { label: "M", qty: 2 }, { label: "L", qty: 6 }]);
  });

  it("a size set to 0 is sent as sold out for that size", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({ body: suit }));
    render(<ProductAdmin initial={[suit]} />);
    await user.click(within(table()).getByRole("button", { name: "Edit Maroon Anarkali Suit" }));
    const form = screen.getByRole("dialog", { name: "Edit product" });
    const m = within(form).getByLabelText("Stock for size M");
    await user.clear(m);
    await user.type(m, "0");
    await user.click(within(form).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock).sizes).toContainEqual({ label: "M", qty: 0 });
  });

});