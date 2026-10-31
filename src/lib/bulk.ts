import { productInput } from "./validation";

/* Bulk product upload from a spreadsheet. The browser parses the file (CSV or Excel) and previews it; the server parses it AGAIN
   with the same code before saving, so nothing is trusted from the browser. */

export const BULK_MAX = 200;
export type RawRow = Record<string, string>;

const ALIAS: Record<string, string> = {
  title: "name", product: "name", product_name: "name",
  collection: "category", category: "category",
  selling_price: "price", sale_price: "price", mrp: "mrp", original_price: "mrp",
  size: "sizes", stock: "units", quantity: "units", qty: "units", colour: "colors", color: "colors", colours: "colors",
  wash_care: "washcare", care: "washcare", video: "video_url", video_link: "video_url", highlight: "highlights", badge: "badges", tags: "badges", tag: "badges",
  featured_on_home: "featured", return: "returnable", returns: "returnable", exchange: "exchangeable",
};
export const normHeader = (h: string) => { const k = h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); return ALIAS[k] ?? k.replace(/_/g, ""); };

/** Turns a table (first row = headers) into row objects with normalised keys. Empty rows are skipped. */
export function tableToRows(table: string[][]): RawRow[] {
  if (table.length < 2) return [];
  const heads = table[0].map(normHeader);
  return table.slice(1).filter((r) => r.some((c) => String(c ?? "").trim() !== "")).map((r) => Object.fromEntries(heads.map((h, i) => [h, String(r[i] ?? "").trim()])));
}

/** Small RFC-4180 CSV reader (quotes, commas and line breaks inside quotes). */
export function parseCsv(text: string): string[][] {
  const out: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  const t = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cur); out.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); out.push(row); }
  return out;
}

const yes = (v: string | undefined, dflt: boolean) => { const s = (v ?? "").trim().toLowerCase(); if (!s) return dflt; return ["yes", "y", "true", "1", "on"].includes(s); };
const list = (v: string | undefined, sep: RegExp) => (v ?? "").split(sep).map((x) => x.trim()).filter(Boolean);

/** "S:5, M:3, L" → [{S,5},{M,3},{L,default}] */
export function parseSizes(v: string | undefined, defaultQty = 5) {
  return list(v, /[,;|]/).map((p) => { const [label, q] = p.split(":").map((x) => x.trim()); return { label, qty: q === undefined || q === "" ? defaultQty : Number(q) }; });
}
/** "Maroon:#8c1d40, Green" → [{Maroon,#8c1d40},{Green}] */
export function parseColors(v: string | undefined) {
  return list(v, /[,;|]/).map((p) => { const i = p.lastIndexOf(":"); const hex = i > 0 && /^#[0-9a-fA-F]{6}$/.test(p.slice(i + 1).trim()) ? p.slice(i + 1).trim() : undefined; return { name: (hex ? p.slice(0, i) : p).trim(), hex, images: [] as string[] }; });
}

/** One spreadsheet row → validated product input (or a readable error for that row). */
export function rowToProduct(r: RawRow): { input: ReturnType<typeof productInput.parse>; error?: undefined } | { input?: undefined; error: string } {
  const type = /^acc/i.test(r.type ?? "") ? "accessory" : "clothing";
  const sizes = type === "clothing" ? parseSizes(r.sizes) : [];
  const parsed = productInput.safeParse({
    type, name: r.name, category: r.category, price: r.price, mrp: r.mrp ? r.mrp : undefined, brand: "", condition: "New", warranty: "",
    units: sizes.length ? undefined : r.units === undefined || r.units === "" ? (type === "accessory" ? undefined : undefined) : r.units,
    sizes, colors: parseColors(r.colors), fabric: r.fabric ?? "", fit: r.fit ?? "", occasion: r.occasion ?? "", washCare: r.washcare ?? "",
    badges: list(r.badges, /[,;|]/).slice(0, 5), featured: yes(r.featured, false), returnable: yes(r.returnable, true), exchangeable: yes(r.exchangeable, true),
    videoUrl: r.video_url ?? "", highlights: list(r.highlights, /[|\n]/).slice(0, 3), description: r.description ?? "", tags: [], specs: {}, included: [], conditionNotes: [], images: [],
  });
  if (parsed.success) return { input: parsed.data };
  const i = parsed.error.issues[0];
  return { error: `${String(i.path[0] ?? "row")}: ${i.message}` };
}

export const TEMPLATE_CSV = [
  "name,collection,price,mrp,sizes,colors,fabric,fit,occasion,wash_care,badges,featured,returnable,exchangeable,video_url,highlights,description",
  '"Maroon Anarkali Suit Set",Suit Sets,2499,3499,"S:4,M:6,L:6,XL:3","Maroon:#8c1d40,Bottle Green:#166534",Pure cotton,A-line,Festive,"Hand wash in cold water",Best Seller,yes,yes,yes,,"Soft cotton|Hand-block print|Comes with dupatta","Soft cotton anarkali suit set for festive days."',
  '"Ivory Chikankari Kurti",Kurtis,1299,1899,"S,M,L,XL",Ivory,Cotton,Straight,Daily wear,"Gentle machine wash",New,no,no,yes,,,"Lucknowi chikankari kurti in breathable cotton."',
].join("\n");
