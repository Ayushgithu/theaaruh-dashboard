# Clothing Dashboard (admin panel)

Next.js 16 · MongoDB. Orders, carts, customers, **clothing products with sizes / colours / fabric / per-size stock**, accessories,
collections (from product categories), top bar, hero carousel, banners, enquiries, settings. Same look as before.

Separate from the public website (`clothing-website`). Both use the SAME MongoDB, so use the same `MONGODB_URI`.

```bash
cp .env.example .env.local
npm install
npm run seed:admin     # creates your admin only (or `npm run seed` for admin + 11 sample outfits)
npm run dev            # http://localhost:3000   (use `npm run dev -- -p 3001` if the website runs locally too)
```

- `/` opens `/admin`; signed-out visitors go to `/login` (sign in, forgot / reset password).
- Deploy as its own project (e.g. `admin.yourbrand.com`). Set `NEXT_PUBLIC_DASHBOARD_URL` to that address and `NEXT_PUBLIC_SITE_URL` to the website address.

## New in this version
**Wallet** (refund returns to the customer's wallet with an optional bonus %, gift or correct credit from Customers → Wallet) ·
**Delivery time rules** (cut-off hour, packing days, transit days, Sundays, faster areas) · **Flash sale** per product (price + end time) ·
**Print packing slip + shipping label** (Orders → open an order, or "Print slips for N orders to pack") ·
**Carts** now shows who the shopper is: purchase history, wallet, address, how long ago they left, with WhatsApp / call / email / copy-details.

## Pages
Dashboard · Orders · **Returns** · Carts · Customers · Clothing (**bulk upload**) · Accessories · Top bar · Hero carousel · Banners · Enquiries ·
**Insights** (sales per day, best-selling sizes, return reasons) · **Notifications** (push) · **Store rules** · Settings.

## Store rules (Dashboard → Store rules)
Delivery fee and free-shipping amount · **delivery time promise** · **wallet bonus** · COD on/off, limit, **advance** (₹100–200 stops most fake COD orders) · **blocked pincodes** (COD only, or no delivery) ·
guest checkout · return/exchange on/off, windows, reasons · **size chart** for the size recommender · **sale countdown** · parcel size for Shiprocket.
Returns and exchanges can also be switched off **per product** (edit product).

## Shiprocket
Set the `SHIPROCKET_*` variables (see `.env.example`). Then in **Orders** → open an order → **Ship with Shiprocket** creates the shipment, picks a courier,
schedules pickup, saves the AWB + label and emails the customer. Add the webhook in Shiprocket (URL `https://YOUR-DASHBOARD/api/shiprocket/webhook`,
token = `SHIPROCKET_WEBHOOK_TOKEN`) and every courier scan updates the order, the customer's tracking page and marks it delivered automatically.
In **Returns**, "Book pickup with Shiprocket" arranges the reverse pickup. *This integration was written to Shiprocket's public API docs and tested against
mocked responses only — ship one test order first and check the weight, address and COD amount in your Shiprocket panel.*

## Photos & videos (Cloudinary)
Set the `CLOUDINARY_*` variables (see `.env.example`). Uploads go: browser → this server → **Cloudinary**; the Cloudinary link and details are then saved in
**MongoDB** (`images` collection) and the product keeps a short address (`/api/images/<id>` or `/api/videos/<id>`). When anyone opens that address the server looks the
record up in MongoDB and sends the browser to the Cloudinary file. Deleting a product's photo also deletes it from Cloudinary. Without the keys, photos fall back to being stored in MongoDB (old behaviour); videos need Cloudinary.
Existing photos keep working. **The website must use the same updated `/api/images/[id]` route** (and add `/api/videos/[id]`), because it shows these addresses too.
Note: hosts such as Vercel limit request bodies to about 4.5 MB, so large videos should be pasted as a link or the upload moved to direct-from-browser signed uploads.

## Razorpay
Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (refunds on cancel/return, COD advance) and `RAZORPAY_WEBHOOK_SECRET`.
In Razorpay → Settings → Webhooks add `https://YOUR-DASHBOARD/api/razorpay/webhook` with events `payment.captured` and `order.paid`.
It confirms orders whose customer paid but never returned to the site (signature- and amount-checked, safe to receive twice).

## Returns & exchanges
Customer asks from the order page → you **Approve / Reject** → arrange pickup → **Mark received** (puts the piece back in the right size) → **Refund**
(online via Razorpay, or record a manual UPI/bank refund for COD) or **Mark replacement shipped** (takes the new size out of stock). Customers get an email at each step.

## Bulk upload
Clothing → **Bulk upload**: download the template, fill it in Excel, save as .xlsx or .csv, upload. You see every row checked before anything is saved. Photos are added afterwards.

## Adding a product
Admin → **Clothing** → Add product: name, **collection** (e.g. Suit Sets — this creates the collection on the website), price + MRP (discount % is automatic),
tap the **sizes** you have and enter pieces per size, add **colours**, fabric / fit / occasion / wash care, tags (New, Best Seller, Trending, Deal), photos (portrait works best).
Stock reduces per size when customers buy, and a sold-out size is greyed out on the website.

## Printing slips & labels
Set `NEXT_PUBLIC_STORE_ADDRESS` and `NEXT_PUBLIC_STORE_PHONE` (the "From" address on the label). The page prints one A4 sheet per order: packing slip (tick-boxes, COD amount to collect, thanks note) and a ready label below it.
If you shipped with Shiprocket, its own label PDF (with the courier barcode) is linked on the page — use that one on the parcel when the courier needs to scan it.

## Carts = abandoned-cart list
Shoppers who are signed in show their name, phone, email, past orders, wallet and address. *Guests* (not signed in) show only their items until they sign in or check out — that is a limit of the web, not a bug.
