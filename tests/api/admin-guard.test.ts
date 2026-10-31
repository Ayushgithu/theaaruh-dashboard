// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn(async () => null), createSession: vi.fn(), destroySession: vi.fn() }));
vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/images", () => ({ saveImage: vi.fn(), deleteImages: vi.fn() }));

import * as products from "@/app/api/admin/products/route";
import * as productById from "@/app/api/admin/products/[id]/route";
import * as banners from "@/app/api/admin/banners/route";
import * as bannerById from "@/app/api/admin/banners/[id]/route";
import * as enquiryById from "@/app/api/admin/enquiries/[id]/route";
import * as admins from "@/app/api/admin/admins/route";
import * as adminById from "@/app/api/admin/admins/[id]/route";
import * as announcements from "@/app/api/admin/announcements/route";
import * as announcementById from "@/app/api/admin/announcements/[id]/route";
import * as orderById from "@/app/api/admin/orders/[id]/route";
import * as password from "@/app/api/admin/password/route";
import * as upload from "@/app/api/admin/upload/route";
import { ID, ctx, jsonReq, validProduct } from "./utils";

type Handler = (req: Request, c: ReturnType<typeof ctx>) => Promise<Response>;

const routes: [string, Handler, string, unknown?][] = [
  ["POST /api/admin/products", products.POST as Handler, "POST", validProduct],
  ["PUT /api/admin/products/:id", productById.PUT as Handler, "PUT", validProduct],
  ["DELETE /api/admin/products/:id", productById.DELETE as Handler, "DELETE"],
  ["POST /api/admin/banners", banners.POST as Handler, "POST", {}],
  ["PUT /api/admin/banners/:id", bannerById.PUT as Handler, "PUT", { active: false }],
  ["DELETE /api/admin/banners/:id", bannerById.DELETE as Handler, "DELETE"],
  ["PATCH /api/admin/enquiries/:id", enquiryById.PATCH as Handler, "PATCH", { status: "closed" }],
  ["POST /api/admin/admins", admins.POST as Handler, "POST", {}],
  ["DELETE /api/admin/admins/:id", adminById.DELETE as Handler, "DELETE"],
  ["POST /api/admin/announcements", announcements.POST as Handler, "POST", {}],
  ["PUT /api/admin/announcements/:id", announcementById.PUT as Handler, "PUT", { active: false }],
  ["DELETE /api/admin/announcements/:id", announcementById.DELETE as Handler, "DELETE"],
  ["PATCH /api/admin/orders/:id", orderById.PATCH as Handler, "PATCH", { status: "confirmed" }],
  ["POST /api/admin/password", password.POST as Handler, "POST", {}],
  ["POST /api/admin/upload", upload.POST as Handler, "POST", {}],
];

describe("every admin API route rejects signed-out requests", () => {
  it.each(routes)("%s → 401", async (_name, handler, method, body) => {
    const res = await handler(jsonReq("/api/admin/x", method, body), ctx({ id: ID }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/sign in/i);
  });
});
