import { describe, expect, it, vi } from "vitest";

vi.mock("@/models/Product", () => ({ ProductModel: { exists: vi.fn() } }));
vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));

import { ProductModel } from "@/models/Product";
import { fieldsFromInput, uniqueSlug } from "@/lib/product-write";
import { artFor } from "@/lib/repo";
import { productInput } from "@/lib/validation";

const input = (over: Record<string, unknown> = {}) =>
  productInput.parse({
    type: "clothing", name: "Maroon Anarkali Suit", brand: "", category: "Suit Sets", price: 32999, mrp: 74000,
    units: 8, specs: { Fabric: "Pure cotton", Fit: "A-line", Occasion: "Festive", Care: "Hand wash" },
    description: "Soft, breathable everyday suit set.", ...over,
  });

describe("fieldsFromInput → stock status", () => {
  it("in stock above 3 units", () => expect(fieldsFromInput(input({ units: 4 })).stock).toBe("in-stock"));
  it("low stock at 1–3 units, keeping the count", () => {
    const f = fieldsFromInput(input({ units: 2 }));
    expect(f.stock).toBe("low");
    expect(f.stockCount).toBe(2);
  });
  it("sold out at 0 units", () => expect(fieldsFromInput(input({ units: 0 })).stock).toBe("out"));
  it("keeps the quantity on hand", () => expect(fieldsFromInput(input({ units: 7 })).quantity).toBe(7));
});

describe("fieldsFromInput → other fields", () => {
  it("uses the first 3 spec values as card highlights when none are given", () => {
    expect(fieldsFromInput(input()).highlights).toEqual(["Pure cotton", "A-line", "Festive"]);
  });
  it("keeps custom highlights", () => {
    expect(fieldsFromInput(input({ highlights: ["Pure cotton", "2 pc set"] })).highlights).toEqual(["Pure cotton", "2 pc set"]);
  });
  it("drops an MRP that is not higher than the price", () => {
    expect(fieldsFromInput(input({ mrp: 1000 })).mrp).toBeUndefined();
    expect(fieldsFromInput(input({ mrp: 74000 })).mrp).toBe(74000);
  });
  it("always saves the product as clothing", () => expect(fieldsFromInput(input()).type).toBe("clothing"));
});

describe("uniqueSlug", () => {
  it("slugifies the name", async () => {
    vi.mocked(ProductModel.exists).mockResolvedValue(null as never);
    expect(await uniqueSlug("Maroon Anarkali Suit (Cotton/M)")).toBe("maroon-anarkali-suit-cotton-m");
  });
  it("adds a number when the slug is already taken", async () => {
    vi.mocked(ProductModel.exists).mockResolvedValueOnce({ _id: "x" } as never).mockResolvedValueOnce({ _id: "y" } as never).mockResolvedValue(null as never);
    expect(await uniqueSlug("Maroon Suit")).toBe("maroon-suit-3");
  });
  it("never returns an empty slug", async () => {
    vi.mocked(ProductModel.exists).mockResolvedValue(null as never);
    expect(await uniqueSlug("!!!")).toBe("product");
  });
});

describe("artFor (placeholder illustration for products without photos)", () => {
  it("always gives the outfit illustration", () => expect(artFor({ name: "Maroon Kurti" }).kind).toBe("cloth"));
  it("is stable for the same name", () => {
    expect(artFor({ name: "Maroon Kurti" })).toEqual(artFor({ name: "Maroon Kurti" }));
  });
});