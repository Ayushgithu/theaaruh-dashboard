// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn(), createSession: vi.fn(), destroySession: vi.fn() }));
vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/images", () => ({ saveImage: vi.fn(), deleteImages: vi.fn() }));
vi.mock("@/models/Product", () => ({ ProductModel: { create: vi.fn(), exists: vi.fn(), findById: vi.fn() } }));

import { getSession } from "@/lib/auth";
import { deleteImages } from "@/lib/images";
import { ProductModel } from "@/models/Product";
import { POST } from "@/app/api/admin/products/route";
import { DELETE, PUT } from "@/app/api/admin/products/[id]/route";
import { ID, URL_A, URL_B, ctx, jsonReq, validProduct } from "./utils";

const signedIn = () => vi.mocked(getSession).mockResolvedValue({ id: "a1", email: "owner@shop.com", name: "Owner" });
const model = ProductModel as unknown as Record<"create" | "exists" | "findById", ReturnType<typeof vi.fn>>;

beforeEach(() => {
  signedIn();
  model.exists.mockResolvedValue(null);
  model.create.mockImplementation(async (doc: Record<string, unknown>) => ({ toObject: () => ({ _id: ID, createdAt: new Date(), ...doc }) }));
});

describe("POST /api/admin/products", () => {
  it("creates a product, derives stock/slug/art, and returns it", async () => {
    const res = await POST(jsonReq("/api/admin/products", "POST", validProduct), ctx());
    expect(res.status).toBe(201);
    const saved = model.create.mock.calls[0][0];
    expect(saved).toMatchObject({ slug: "maroon-anarkali-suit", stock: "low", stockCount: 2, views: 0, featured: true, images: [URL_A], tags: ["festive"] });
    expect(saved.art).toMatchObject({ kind: "cloth" });
    const body = await res.json();
    expect(body).toMatchObject({ id: ID, name: "Maroon Anarkali Suit", price: 32999, stock: "low", slug: "maroon-anarkali-suit" });
  });

  it("gives a unique slug when the name already exists", async () => {
    model.exists.mockResolvedValueOnce({ _id: "x" }).mockResolvedValue(null);
    await POST(jsonReq("/api/admin/products", "POST", validProduct), ctx());
    expect(model.create.mock.calls[0][0].slug).toBe("maroon-anarkali-suit-2");
  });

  it("0 units means sold out; units are stored as the quantity on hand", async () => {
    await POST(jsonReq("/api/admin/products", "POST", { ...validProduct, units: 0 }), ctx());
    expect(model.create.mock.calls[0][0]).toMatchObject({ stock: "out", quantity: 0 });
  });

  it("stores the quantity so stock can drop automatically when customers buy", async () => {
    await POST(jsonReq("/api/admin/products", "POST", { ...validProduct, units: 8 }), ctx());
    expect(model.create.mock.calls[0][0]).toMatchObject({ stock: "in-stock", quantity: 8 });
  });

  const cloth = { type: "clothing", name: "Maroon Anarkali Suit", category: "Suit Sets", price: 2499, mrp: 3499, description: "Soft cotton anarkali suit set.", images: [] };

  it("clothing: units are the sum of the sizes, and the per-size stock, colours and details are stored", async () => {
    const res = await POST(jsonReq("/api/admin/products", "POST", {
      ...cloth, sizes: [{ label: "S", qty: 0 }, { label: "M", qty: 2 }, { label: "L", qty: 3 }],
      colors: [{ name: "Maroon", hex: "#8c1d40" }], fabric: "Pure cotton", washCare: "Hand wash", badges: ["New"],
    }), ctx());
    expect(res.status).toBe(201);
    const saved = model.create.mock.calls[0][0];
    expect(saved).toMatchObject({ type: "clothing", quantity: 5, stock: "in-stock", fabric: "Pure cotton", washCare: "Hand wash", badges: ["New"], slug: "maroon-anarkali-suit" });
    expect(saved.sizes).toEqual([{ label: "S", qty: 0 }, { label: "M", qty: 2 }, { label: "L", qty: 3 }]);
    expect(saved.colors).toEqual([{ name: "Maroon", hex: "#8c1d40", images: [] }]);
    expect(saved.art).toMatchObject({ kind: "cloth" });
  });

  it("clothing: every size sold out means the product is sold out", async () => {
    await POST(jsonReq("/api/admin/products", "POST", { ...cloth, sizes: [{ label: "M", qty: 0 }] }), ctx());
    expect(model.create.mock.calls[0][0]).toMatchObject({ quantity: 0, stock: "out" });
  });

  it("clothing needs units or sizes; brand is optional", async () => {
    const bad = await POST(jsonReq("/api/admin/products", "POST", cloth), ctx());
    expect(bad.status).toBe(400);
    const ok = await POST(jsonReq("/api/admin/products", "POST", { ...cloth, units: 4 }), ctx());
    expect(ok.status).toBe(201);
    expect(model.create.mock.calls[0][0]).toMatchObject({ quantity: 4, brand: "" });
  });

  it("400 with a readable message for invalid data; nothing is saved", async () => {
    const res = await POST(jsonReq("/api/admin/products", "POST", { ...validProduct, price: -5 }), ctx());
    expect(res.status).toBe(400);
    expect(typeof (await res.json()).error).toBe("string");
    expect(model.create).not.toHaveBeenCalled();
  });

  it("rejects images that are not our own uploads", async () => {
    const res = await POST(jsonReq("/api/admin/products", "POST", { ...validProduct, images: ["https://evil.example/x.png"] }), ctx());
    expect(res.status).toBe(400);
  });

  it("400 for a broken JSON body", async () => {
    const res = await POST(jsonReq("/api/admin/products", "POST", "{not json"), ctx());
    expect(res.status).toBe(400);
  });

  it("500 (without leaking details) if the database fails", async () => {
    model.create.mockRejectedValue(new Error("E11000 duplicate key secret-host:27017"));
    const res = await POST(jsonReq("/api/admin/products", "POST", validProduct), ctx());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret-host");
  });
});

describe("PUT /api/admin/products/:id", () => {
  const doc = () => ({ images: [URL_A, URL_B], set: vi.fn(), save: vi.fn(), toObject: () => ({ _id: ID, ...validProduct, slug: "maroon-anarkali-suit", stock: "low" }) });

  it("updates fields and deletes photos that were removed", async () => {
    const d = doc();
    model.findById.mockResolvedValue(d);
    const res = await PUT(jsonReq(`/api/admin/products/${ID}`, "PUT", { ...validProduct, price: 29999, images: [URL_A] }), ctx({ id: ID }));
    expect(res.status).toBe(200);
    expect(d.set).toHaveBeenCalledWith(expect.objectContaining({ price: 29999, images: [URL_A] }));
    expect(d.save).toHaveBeenCalled();
    expect(deleteImages).toHaveBeenCalledWith([URL_B]);
  });

  it("404 for a malformed id", async () => {
    const res = await PUT(jsonReq("/api/admin/products/nope", "PUT", validProduct), ctx({ id: "nope" }));
    expect(res.status).toBe(404);
  });

  it("404 when the product does not exist", async () => {
    model.findById.mockResolvedValue(null);
    const res = await PUT(jsonReq(`/api/admin/products/${ID}`, "PUT", validProduct), ctx({ id: ID }));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/products/:id", () => {
  it("removes the product and all its photos", async () => {
    const d = { images: [URL_A, URL_B], deleteOne: vi.fn() };
    model.findById.mockResolvedValue(d);
    const res = await DELETE(jsonReq(`/api/admin/products/${ID}`, "DELETE"), ctx({ id: ID }));
    expect(res.status).toBe(200);
    expect(deleteImages).toHaveBeenCalledWith([URL_A, URL_B]);
    expect(d.deleteOne).toHaveBeenCalled();
  });
});