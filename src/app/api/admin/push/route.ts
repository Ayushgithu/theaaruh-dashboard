import { z } from "zod";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";
import { pushConfigured, sendToAll, subscriberCount } from "@/lib/push";

const send = z.object({
  title: z.string().trim().min(2, "Add a title").max(60),
  body: z.string().trim().min(2, "Add a message").max(160),
  url: z.string().trim().max(300).refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v), "Use a page path like /shop or a full https:// link").optional(),
});

export const GET = adminRoute(async () => ok({ configured: pushConfigured(), subscribers: pushConfigured() ? await subscriberCount() : 0 }));

export const POST = adminRoute(async (req) => {
  if (!pushConfigured()) throw new HttpError("Push notifications are not set up. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to the environment variables.", 400);
  const v = send.parse(await readJson(req));
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const url = !v.url ? "/" : v.url.startsWith("/") ? v.url : v.url;
  return ok(await sendToAll({ title: v.title, body: v.body, url: url.startsWith("/") && site ? `${site}${url}` : url }));
});
