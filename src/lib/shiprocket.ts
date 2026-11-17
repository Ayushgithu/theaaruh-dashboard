import { HttpError } from "./api-helpers";

/* Shiprocket (https://apidocs.shiprocket.in). Set SHIPROCKET_EMAIL + SHIPROCKET_PASSWORD (an API user you create in Shiprocket →
   Settings → API) and SHIPROCKET_PICKUP_LOCATION (the nickname of your pickup address in Shiprocket). */
const BASE = "https://apiv2.shiprocket.in/v1/external";
let cached: { token: string; exp: number } | null = null;

export const shiprocketConfigured = () => !!(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
export const resetShiprocketToken = () => { cached = null; };


const messageOf = (j: any) => j?.message || (j?.errors ? Object.values(j.errors).flat().join(", ") : "") || "request failed";

async function login(): Promise<string> {
  const r = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw new HttpError(`Shiprocket login failed: ${messageOf(j)}. Check SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD (use the API user, not your normal login).`, 502);
  cached = { token: j.token, exp: Date.now() + 8 * 24 * 3600_000 }; // tokens last 10 days
  return j.token;
}

async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  if (!shiprocketConfigured()) throw new HttpError("Shiprocket is not set up yet. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD to the dashboard's environment variables.", 400);
  const token = cached && cached.exp > Date.now() ? cached.token : await login();
  const r = await fetch(`${BASE}${path}`, { method: init.method ?? "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: init.body ? JSON.stringify(init.body) : undefined });
  if (r.status === 401 && retry) { cached = null; return api<T>(path, init, false); }
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(`Shiprocket: ${messageOf(j)}`, 502);
  return j as T;
}

/** Finds a key anywhere in a nested response (Shiprocket nests the AWB under a few different shapes). */
export function findDeep(o: any, key: string): any {
  if (!o || typeof o !== "object") return undefined;
  if (o[key] !== undefined && o[key] !== null && o[key] !== "") return o[key];
  for (const v of Object.values(o)) { const f = findDeep(v, key); if (f !== undefined) return f; }
  return undefined;
}

const phone10 = (p: string) => p.replace(/\D/g, "").slice(-10);
const stamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export interface ShipInput {
  orderNumber: string; createdAt: string | Date;
  customer: { name: string; email: string; phone: string };
  address: { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  items: { name: string; slug: string; size?: string; quantity: number; price: number }[];
  total: number; subtotal: number; shipping: number;
  paymentMethod: "cod" | "razorpay"; advancePaid: number;
}
export interface Parcel { weightKg: number; lengthCm: number; breadthCm: number; heightCm: number }

/** Creates the shipment in Shiprocket, assigns the best courier + AWB, requests pickup and fetches the label. */
export async function shipOrder(o: ShipInput, parcel: Parcel) {
  const units = o.items.reduce((n, i) => n + i.quantity, 0);
  const cod = o.paymentMethod === "cod";
  const email = o.customer.email.endsWith("@guest.invalid") ? "" : o.customer.email;
  const created = await api("/orders/create/adhoc", {
    method: "POST",
    body: {
      order_id: o.orderNumber, order_date: stamp(new Date(o.createdAt)), pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
      billing_customer_name: o.address.name.split(" ")[0] || o.address.name, billing_last_name: o.address.name.split(" ").slice(1).join(" "),
      billing_address: o.address.line1, billing_address_2: o.address.line2 ?? "", billing_city: o.address.city, billing_pincode: o.address.pincode, billing_state: o.address.state,
      billing_country: "India", billing_email: email, billing_phone: phone10(o.address.phone), shipping_is_billing: true,
      order_items: o.items.map((i) => ({ name: i.name + (i.size ? ` (${i.size})` : ""), sku: `${i.slug}${i.size ? `-${i.size}` : ""}`.slice(0, 50), units: i.quantity, selling_price: i.price, discount: 0, tax: 0, hsn: "" })),
      payment_method: cod ? "COD" : "Prepaid",
      shipping_charges: 0, giftwrap_charges: 0, transaction_charges: 0, total_discount: 0,
      // for COD, Shiprocket collects `sub_total` from the customer: the order total minus any advance already paid online
      sub_total: cod ? Math.max(0, o.total - o.advancePaid) : o.total,
      length: parcel.lengthCm, breadth: parcel.breadthCm, height: parcel.heightCm, weight: Math.max(0.05, +(parcel.weightKg * Math.max(1, units)).toFixed(2)),
    },
  });
  const shipmentId = findDeep(created, "shipment_id");
  const srOrderId = findDeep(created, "order_id");
  if (!shipmentId) throw new HttpError(`Shiprocket did not create the shipment (${messageOf(created)}). Check the pickup location name and the customer's address.`, 502);

  const warnings: string[] = [];
  const awbRes = await api("/courier/assign/awb", { method: "POST", body: { shipment_id: shipmentId } });
  const awb = findDeep(awbRes, "awb_code");
  const courier = findDeep(awbRes, "courier_name") ?? "";
  if (!awb) throw new HttpError(`The shipment was created in Shiprocket but no courier could be assigned (${messageOf(awbRes)}). Assign one in your Shiprocket panel — it will then sync here.`, 502);

  let labelUrl: string | undefined;
  try { await api("/courier/generate/pickup", { method: "POST", body: { shipment_id: [shipmentId] } }); } catch (e) { warnings.push(`Pickup was not scheduled automatically (${(e as Error).message}).`); }
  try { labelUrl = findDeep(await api("/courier/generate/label", { method: "POST", body: { shipment_id: [shipmentId] } }), "label_url"); } catch (e) { warnings.push(`Label could not be generated (${(e as Error).message}).`); }
  return { orderId: String(srOrderId ?? ""), shipmentId: String(shipmentId), awb: String(awb), courier: String(courier), labelUrl: labelUrl as string | undefined, warnings };
}

export interface ReturnShipInput {
  number: string; customer: { name: string; email: string; phone: string };
  pickup: { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  items: { name: string; slug: string; size?: string; quantity: number; price: number }[];
}
const warehouse = () => ({
  name: process.env.SHIPROCKET_WAREHOUSE_NAME, address: process.env.SHIPROCKET_WAREHOUSE_ADDRESS, city: process.env.SHIPROCKET_WAREHOUSE_CITY,
  state: process.env.SHIPROCKET_WAREHOUSE_STATE, pincode: process.env.SHIPROCKET_WAREHOUSE_PINCODE, phone: process.env.SHIPROCKET_WAREHOUSE_PHONE,
});

/** Reverse pickup: the courier collects the item from the customer and brings it to your warehouse. */
export async function createReturnPickup(r: ReturnShipInput, parcel: Parcel) {
  const w = warehouse();
  if (!w.address || !w.city || !w.state || !w.pincode || !w.phone) throw new HttpError("Set SHIPROCKET_WAREHOUSE_NAME / _ADDRESS / _CITY / _STATE / _PINCODE / _PHONE (where returned items should be delivered) in the dashboard's environment variables.", 400);
  const units = r.items.reduce((n, i) => n + i.quantity, 0);
  const email = r.customer.email.endsWith("@guest.invalid") ? "" : r.customer.email;
  const created = await api("/orders/create/return", {
    method: "POST",
    body: {
      order_id: r.number, order_date: stamp(new Date()), channel_id: "",
      pickup_customer_name: r.pickup.name, pickup_address: r.pickup.line1, pickup_address_2: r.pickup.line2 ?? "", pickup_city: r.pickup.city, pickup_state: r.pickup.state, pickup_country: "India", pickup_pincode: r.pickup.pincode, pickup_email: email, pickup_phone: phone10(r.pickup.phone),
      shipping_customer_name: w.name || "Returns", shipping_address: w.address, shipping_city: w.city, shipping_country: "India", shipping_pincode: w.pincode, shipping_state: w.state, shipping_phone: phone10(w.phone ?? ""),
      order_items: r.items.map((i) => ({ name: i.name + (i.size ? ` (${i.size})` : ""), sku: `${i.slug}${i.size ? `-${i.size}` : ""}`.slice(0, 50), units: i.quantity, selling_price: i.price })),
      payment_method: "Prepaid", total_discount: "0", sub_total: r.items.reduce((n, i) => n + i.price * i.quantity, 0),
      length: parcel.lengthCm, breadth: parcel.breadthCm, height: parcel.heightCm, weight: Math.max(0.05, +(parcel.weightKg * Math.max(1, units)).toFixed(2)),
    },
  });
  const shipmentId = findDeep(created, "shipment_id");
  if (!shipmentId) throw new HttpError(`Shiprocket did not create the return pickup (${messageOf(created)}).`, 502);
  let awb: string | undefined, courier: string | undefined;
  try {
    const a = await api("/courier/assign/awb", { method: "POST", body: { shipment_id: shipmentId, is_return: 1 } });
    awb = findDeep(a, "awb_code"); courier = findDeep(a, "courier_name");
  } catch { /* the pickup exists in Shiprocket even if the courier could not be auto-assigned */ }
  return { orderId: String(findDeep(created, "order_id") ?? ""), shipmentId: String(shipmentId), awb: awb ? String(awb) : undefined, courier: courier ? String(courier) : undefined };
}

export interface TrackResult { status: string; events: { status: string; at: string; location?: string; note?: string }[] }
export async function trackAwb(awb: string): Promise<TrackResult> {
  const j = await api(`/courier/track/awb/${encodeURIComponent(awb)}`);
  const td = j?.tracking_data ?? {};
  const acts: any[] = td.shipment_track_activities ?? [];
  const status: string = td.shipment_track?.[0]?.current_status ?? acts[0]?.["sr-status-label"] ?? "";
  return { status, events: acts.map((a) => ({ status: a["sr-status-label"] || a.activity || "Update", at: new Date(a.date).toISOString(), location: a.location || undefined, note: a.activity || undefined })).filter((e) => !isNaN(+new Date(e.at))) };
}

/** Maps a Shiprocket / courier status text to our order status (or null when it is only an information update). */
export function mapCourierStatus(text: string): "shipped" | "delivered" | null {
  const t = text.toUpperCase();
  if (/RTO|UNDELIVERED|LOST|CANCEL/.test(t)) return null;
  if (/\bDELIVERED\b/.test(t)) return "delivered";
  if (/PICKED UP|IN TRANSIT|OUT FOR DELIVERY|SHIPPED|REACHED|DISPATCHED|OUT FOR PICKUP/.test(t)) return "shipped";
  return null;
}

/** Shiprocket webhook timestamps look like "23 05 2023 11:43:52" (DD MM YYYY HH:mm:ss); other formats fall back to Date parsing. */
export function parseCourierDate(s?: string): Date {
  const m = (s ?? "").match(/^(\d{2}) (\d{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}+05:30`);
  const d = s ? new Date(s) : new Date();
  return isNaN(+d) ? new Date() : d;
}
