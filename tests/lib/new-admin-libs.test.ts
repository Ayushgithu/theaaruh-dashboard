// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findDeep, mapCourierStatus, parseCourierDate, resetShiprocketToken, shipOrder, trackAwb } from "@/lib/shiprocket";
import { applyTrackingEvents } from "@/lib/tracking-sync";
import { parseCsv, parseColors, parseSizes, rowToProduct, tableToRows, TEMPLATE_CSV, normHeader } from "@/lib/bulk";
import { fillDays } from "@/lib/insights";

describe("Shiprocket client", () => {
  const calls: { url: string; body: any; method: string }[] = [];
  beforeEach(() => {
    calls.length = 0; resetShiprocketToken();
    vi.stubEnv("SHIPROCKET_EMAIL", "api@x.com"); vi.stubEnv("SHIPROCKET_PASSWORD", "pw"); vi.stubEnv("SHIPROCKET_PICKUP_LOCATION", "Studio");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
      const body = init?.body ? JSON.parse(init.body) : undefined; calls.push({ url: String(url).replace("https://apiv2.shiprocket.in/v1/external", ""), body, method: init?.method ?? "GET" });
      const u = String(url);
      const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status });
      if (u.endsWith("/auth/login")) return json({ token: "TKN" });
      if (u.endsWith("/orders/create/adhoc")) return json({ order_id: 111, shipment_id: 222 });
      if (u.endsWith("/courier/assign/awb")) return json({ awb_assign_status: 1, response: { data: { awb_code: "AWB123", courier_name: "Delhivery" } } });
      if (u.endsWith("/courier/generate/pickup")) return json({ pickup_status: 1 });
      if (u.endsWith("/courier/generate/label")) return json({ label_created: 1, label_url: "https://label/1.pdf" });
      if (u.includes("/courier/track/awb/")) return json({ tracking_data: { shipment_track: [{ current_status: "In Transit" }], shipment_track_activities: [{ date: "2026-05-23 10:00:00", "sr-status-label": "IN TRANSIT", location: "Pune", activity: "Arrived" }] } });
      return json({ message: "nope" }, 404);
    }));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  const order = { orderNumber: "OD-1", createdAt: new Date("2026-05-20T10:00:00Z"), customer: { name: "Ravi Kumar", email: "r@x.com", phone: "+91 98765 43210" }, address: { name: "Ravi Kumar", phone: "+91 98765 43210", line1: "12 MG Road", city: "Pune", state: "Maharashtra", pincode: "411001" }, items: [{ name: "Suit", slug: "suit", size: "M", quantity: 2, price: 1000 }], total: 2079, subtotal: 2000, shipping: 79, paymentMethod: "cod" as const, advancePaid: 100 };
  const parcel = { weightKg: 0.5, lengthCm: 25, breadthCm: 20, heightCm: 5 };

  it("logs in once, creates the order, assigns a courier, schedules pickup and fetches the label", async () => {
    const r = await shipOrder(order, parcel);
    expect(r).toMatchObject({ orderId: "111", shipmentId: "222", awb: "AWB123", courier: "Delhivery", labelUrl: "https://label/1.pdf", warnings: [] });
    expect(calls.filter((c) => c.url === "/auth/login")).toHaveLength(1);
    const create = calls.find((c) => c.url === "/orders/create/adhoc")!.body;
    expect(create).toMatchObject({ order_id: "OD-1", pickup_location: "Studio", payment_method: "COD", billing_phone: "9876543210", billing_pincode: "411001", weight: 1 /* 0.5kg x 2 pcs */ });
    expect(create.sub_total).toBe(1979); // ₹100 advance was already paid online → collect the rest
    expect(create.order_items[0]).toMatchObject({ name: "Suit (M)", units: 2, selling_price: 1000 });
  });
  it("prepaid orders collect nothing", async () => {
    await shipOrder({ ...order, paymentMethod: "razorpay", advancePaid: 0 }, parcel);
    expect(calls.find((c) => c.url === "/orders/create/adhoc")!.body).toMatchObject({ payment_method: "Prepaid", sub_total: 2079 });
  });
  it("a failed label does not fail the shipment — it comes back as a warning", async () => {
    (fetch as any).mockImplementation(async (url: string) => {
      const u = String(url); const j = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s });
      if (u.endsWith("/auth/login")) return j({ token: "T" });
      if (u.endsWith("/orders/create/adhoc")) return j({ order_id: 1, shipment_id: 2 });
      if (u.endsWith("/courier/assign/awb")) return j({ response: { data: { awb_code: "A1", courier_name: "X" } } });
      if (u.endsWith("/courier/generate/label")) return j({ message: "label service down" }, 500);
      return j({});
    });
    const r = await shipOrder(order, parcel);
    expect(r.awb).toBe("A1");
    expect(r.labelUrl).toBeUndefined();
    expect(r.warnings.join(" ")).toMatch(/Label/);
  });
  it("explains a login failure and a missing setup", async () => {
    (fetch as any).mockImplementation(async () => new Response(JSON.stringify({ message: "Invalid credentials" }), { status: 403 }));
    resetShiprocketToken();
    await expect(shipOrder(order, parcel)).rejects.toThrow(/login failed.*Invalid credentials/);
    vi.stubEnv("SHIPROCKET_EMAIL", "");
    await expect(shipOrder(order, parcel)).rejects.toThrow(/not set up/);
  });
  it("reads scans from the track API", async () => {
    const t = await trackAwb("AWB123");
    expect(t.status).toBe("In Transit");
    expect(t.events[0]).toMatchObject({ status: "IN TRANSIT", location: "Pune" });
  });
});

describe("courier status helpers", () => {
  it("maps statuses to order status and ignores RTO", () => {
    expect(mapCourierStatus("DELIVERED")).toBe("delivered");
    expect(mapCourierStatus("Out For Delivery")).toBe("shipped");
    expect(mapCourierStatus("PICKED UP")).toBe("shipped");
    expect(mapCourierStatus("RTO DELIVERED")).toBeNull();
    expect(mapCourierStatus("UNDELIVERED")).toBeNull();
    expect(mapCourierStatus("Manifested")).toBeNull();
  });
  it("parses Shiprocket's DD MM YYYY timestamps in IST", () => {
    expect(parseCourierDate("23 05 2023 11:43:52").toISOString()).toBe("2023-05-23T06:13:52.000Z");
    expect(parseCourierDate(undefined)).toBeInstanceOf(Date);
    expect(parseCourierDate("garbage")).toBeInstanceOf(Date);
  });
  it("findDeep digs through nested responses", () => {
    expect(findDeep({ a: { b: [{ awb_code: "X" }] } }, "awb_code")).toBe("X");
    expect(findDeep({ a: 1 }, "awb_code")).toBeUndefined();
  });
  it("applyTrackingEvents moves status forward only, and never backwards", () => {
    const o: any = { status: "confirmed", timeline: [], trackingEvents: [], payment: { method: "razorpay" } };
    expect(applyTrackingEvents(o, [], "PICKED UP")).toBe("shipped");
    expect(o.status).toBe("shipped");
    expect(applyTrackingEvents(o, [], "PICKED UP")).toBeNull();
    expect(applyTrackingEvents(o, [{ status: "Delivered", at: new Date() }], "DELIVERED")).toBe("delivered");
    o.status = "delivered";
    expect(applyTrackingEvents(o, [], "IN TRANSIT")).toBeNull(); // a late scan cannot un-deliver the order
    expect(o.status).toBe("delivered");
  });
});

describe("bulk upload parsing", () => {
  it("reads CSV with quotes, commas and line breaks inside quotes", () => {
    expect(parseCsv('a,b\n"x, y","line1\nline2"\n')).toEqual([["a", "b"], ["x, y", "line1\nline2"]]);
    expect(parseCsv('\uFEFFa,b\r\n1,"he said ""hi"""')).toEqual([["a", "b"], ["1", 'he said "hi"']]);
  });
  it("understands header variations", () => {
    expect(["Selling Price", "Wash Care", "Colour", "Collection", "Video"].map(normHeader)).toEqual(["price", "washcare", "colors", "category", "video_url"]);
  });
  it("parses sizes and colours", () => {
    expect(parseSizes("S:4, M:6,L")).toEqual([{ label: "S", qty: 4 }, { label: "M", qty: 6 }, { label: "L", qty: 5 }]);
    expect(parseColors("Maroon:#8c1d40, Green, Navy:#zzz")).toEqual([{ name: "Maroon", hex: "#8c1d40", images: [] }, { name: "Green", hex: undefined, images: [] }, { name: "Navy:#zzz", hex: undefined, images: [] }]);
  });
  it("the downloadable template is valid and every example row passes", () => {
    const rows = tableToRows(parseCsv(TEMPLATE_CSV));
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(rowToProduct(r).error).toBeUndefined();
    expect(rowToProduct(rows[1]).input?.returnable).toBe(false);
  });
  it("gives a readable error per field", () => {
    expect(rowToProduct({ name: "ab", category: "x", price: "10", sizes: "M", description: "long enough description" }).error).toMatch(/name/);
    expect(rowToProduct({ name: "Good name", category: "Kurtis", price: "10", description: "long enough description" }).error).toMatch(/units/); // no sizes and no units
  });
});

describe("insights: fillDays", () => {
  it("gives one bar per day with zeros for quiet days, in order", () => {
    const now = Date.parse("2026-06-10T10:00:00Z");
    const d = fillDays([{ _id: "2026-06-09", revenue: 500, orders: 2 }, { _id: "2026-06-10", revenue: 900, orders: 3 }], 4, now);
    expect(d.map((x) => x.date)).toEqual(["2026-06-07", "2026-06-08", "2026-06-09", "2026-06-10"]);
    expect(d.map((x) => x.revenue)).toEqual([0, 0, 500, 900]);
  });
});
