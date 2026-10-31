import { describe, expect, it, vi } from "vitest";

vi.mock("@/models/Product", () => ({ ProductModel: { exists: vi.fn() } }));
vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));

import { ProductModel } from "@/models/Product";
import { fieldsFromInput, uniqueSlug } from "@/lib/product-write";
import { artFor } from "@/lib/repo";
import { productInput } from "@/lib/validation";

const input = (over: Record<string, unknown> = {}) =>
  productInput.parse({
    type: "laptop", name: "Dell Latitude 5420", brand: "Dell", category: "Business", price: 32999, mrp: 74000, condition: "A",
    units: 8, specs: { Processor: "i5", RAM: "16 GB", Storage: "512 GB", Display: "14 inch" },
    description: "A dependable daily driver.", warranty: "1 year", ...over,
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
    expect(fieldsFromInput(input()).highlights).toEqual(["i5", "16 GB", "512 GB"]);
  });
  it("keeps custom highlights", () => {
    expect(fieldsFromInput(input({ highlights: ["Core i5", "16 GB"] })).highlights).toEqual(["Core i5", "16 GB"]);
  });
  it("drops an MRP that is not higher than the price", () => {
    expect(fieldsFromInput(input({ mrp: 1000 })).mrp).toBeUndefined();
    expect(fieldsFromInput(input({ mrp: 74000 })).mrp).toBe(74000);
  });
  it("only laptops carry filter fields", () => {
    const laptop = fieldsFromInput(input({ ramGb: 16, cpu: "Intel Core i5", screenIn: 14 }));
    expect(laptop).toMatchObject({ ramGb: 16, cpu: "Intel Core i5", screenIn: 14 });
    const acc = fieldsFromInput(input({ type: "accessory", category: "Chargers", ramGb: 16, cpu: "x", screenIn: 14 }));
    expect(acc.ramGb).toBeUndefined();
    expect(acc.cpu).toBeUndefined();
  });
});

describe("uniqueSlug", () => {
  it("slugifies the name", async () => {
    vi.mocked(ProductModel.exists).mockResolvedValue(null as never);
    expect(await uniqueSlug("Dell Latitude 5420 (i5/16GB)")).toBe("dell-latitude-5420-i5-16gb");
  });
  it("adds a number when the slug is already taken", async () => {
    vi.mocked(ProductModel.exists).mockResolvedValueOnce({ _id: "x" } as never).mockResolvedValueOnce({ _id: "y" } as never).mockResolvedValue(null as never);
    expect(await uniqueSlug("Dell Latitude")).toBe("dell-latitude-3");
  });
  it("never returns an empty slug", async () => {
    vi.mocked(ProductModel.exists).mockResolvedValue(null as never);
    expect(await uniqueSlug("!!!")).toBe("product");
  });
});

describe("artFor (placeholder illustration for products without photos)", () => {
  const base = { brand: "Dell", category: "Business", tags: [] as string[], name: "Dell X" };
  it("gaming laptops get the gaming art", () => expect(artFor({ ...base, type: "laptop", tags: ["gaming"] }).kind).toBe("gaming"));
  it("Apple laptops get the MacBook art", () => expect(artFor({ ...base, type: "laptop", brand: "Apple" }).kind).toBe("macbook"));
  it("accessories map from category", () => {
    expect(artFor({ ...base, type: "accessory", category: "Chargers" }).kind).toBe("charger");
    expect(artFor({ ...base, type: "accessory", category: "Storage" }).kind).toBe("ssd");
    expect(artFor({ ...base, type: "accessory", category: "Something new" }).kind).toBe("hub");
  });
  it("is stable for the same name", () => {
    expect(artFor({ ...base, type: "laptop" })).toEqual(artFor({ ...base, type: "laptop" }));
  });
});
