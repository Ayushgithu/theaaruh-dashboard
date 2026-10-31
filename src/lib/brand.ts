/** Shown in the dashboard header, page titles, packing slips and message templates. Set these in .env.local / Vercel. */
export const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "Your Brand";
/** "From" address printed on shipping labels / packing slips (your studio or shop). */
export const storeAddress = process.env.NEXT_PUBLIC_STORE_ADDRESS || "";
export const storePhone = process.env.NEXT_PUBLIC_STORE_PHONE || "";
