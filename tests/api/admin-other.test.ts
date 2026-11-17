// @vitest-environment node
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn(), createSession: vi.fn(), destroySession: vi.fn() }));
vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/images", () => ({ saveImage: vi.fn(), deleteImages: vi.fn() }));
vi.mock("@/models/Banner", () => ({ BannerModel: { create: vi.fn(), findById: vi.fn() } }));
vi.mock("@/models/Enquiry", () => ({ EnquiryModel: { updateOne: vi.fn() } }));
vi.mock("@/models/Admin", () => ({ AdminModel: { create: vi.fn(), exists: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), deleteOne: vi.fn() } }));

import { getSession } from "@/lib/auth";
import { deleteImages } from "@/lib/images";
import { BannerModel } from "@/models/Banner";
import { EnquiryModel } from "@/models/Enquiry";
import { AdminModel } from "@/models/Admin";
import * as banners from "@/app/api/admin/banners/route";
import * as bannerById from "@/app/api/admin/banners/[id]/route";
import * as enquiryById from "@/app/api/admin/enquiries/[id]/route";
import * as admins from "@/app/api/admin/admins/route";
import * as adminById from "@/app/api/admin/admins/[id]/route";
import * as password from "@/app/api/admin/password/route";
import { ID, ID2, URL_A, ctx, jsonReq } from "./utils";


const Banner = BannerModel as any, Enquiry = EnquiryModel as any, Admin = AdminModel as any;
const me = { id: ID, email: "owner@shop.com", name: "Owner" };
beforeEach(() => vi.mocked(getSession).mockResolvedValue(me));

describe("banners", () => {
  const body = { title: "Festive sale", subtitle: "Up to 60% off", cta: "Shop", href: "/laptops", theme: "blue", active: true };

  it("POST creates a banner", async () => {
    Banner.create.mockResolvedValue({ _id: ID });
    const res = await banners.POST(jsonReq("/api/admin/banners", "POST", body), ctx());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: ID });
    expect(Banner.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Festive sale", active: true }));
  });

  it("POST rejects javascript: links", async () => {
    const res = await banners.POST(jsonReq("/api/admin/banners", "POST", { ...body, href: "javascript:alert(1)" }), ctx());
    expect(res.status).toBe(400);
    expect(Banner.create).not.toHaveBeenCalled();
  });

  it("PUT with only { active } is a quick on/off toggle", async () => {
    const doc = { active: true, set: vi.fn(), save: vi.fn() };
    Banner.findById.mockResolvedValue(doc);
    const res = await bannerById.PUT(jsonReq(`/api/admin/banners/${ID}`, "PUT", { active: false }), ctx({ id: ID }));
    expect(res.status).toBe(200);
    expect(doc.active).toBe(false);
    expect(doc.set).not.toHaveBeenCalled();
    expect(doc.save).toHaveBeenCalled();
  });

  it("PUT with a new image deletes the old one", async () => {
    const doc = { image: URL_A, set: vi.fn(), save: vi.fn() };
    Banner.findById.mockResolvedValue(doc);
    await bannerById.PUT(jsonReq(`/api/admin/banners/${ID}`, "PUT", { ...body, image: null }), ctx({ id: ID }));
    expect(deleteImages).toHaveBeenCalledWith([URL_A]);
  });

  it("DELETE removes the banner and its image", async () => {
    const doc = { image: URL_A, deleteOne: vi.fn() };
    Banner.findById.mockResolvedValue(doc);
    const res = await bannerById.DELETE(jsonReq(`/api/admin/banners/${ID}`, "DELETE"), ctx({ id: ID }));
    expect(res.status).toBe(200);
    expect(deleteImages).toHaveBeenCalledWith([URL_A]);
    expect(doc.deleteOne).toHaveBeenCalled();
  });
});

describe("enquiry status", () => {
  it("updates to a valid status", async () => {
    Enquiry.updateOne.mockResolvedValue({ matchedCount: 1 });
    const res = await enquiryById.PATCH(jsonReq(`/api/admin/enquiries/${ID}`, "PATCH", { status: "contacted" }), ctx({ id: ID }));
    expect(res.status).toBe(200);
    expect(Enquiry.updateOne).toHaveBeenCalledWith({ _id: ID }, { status: "contacted" });
  });
  it("rejects an unknown status", async () => {
    const res = await enquiryById.PATCH(jsonReq(`/api/admin/enquiries/${ID}`, "PATCH", { status: "deleted" }), ctx({ id: ID }));
    expect(res.status).toBe(400);
  });
  it("404 when nothing matched", async () => {
    Enquiry.updateOne.mockResolvedValue({ matchedCount: 0 });
    const res = await enquiryById.PATCH(jsonReq(`/api/admin/enquiries/${ID}`, "PATCH", { status: "closed" }), ctx({ id: ID }));
    expect(res.status).toBe(404);
  });
});

describe("admin accounts", () => {
  it("POST stores a bcrypt hash, never the plain password", async () => {
    Admin.exists.mockResolvedValue(null);
    Admin.create.mockImplementation(async (d: any) => ({ _id: ID2, ...d }));
    const res = await admins.POST(jsonReq("/api/admin/admins", "POST", { name: "Sales", email: "Sales@Shop.com", password: "temporary123" }), ctx());
    expect(res.status).toBe(201);
    const saved = Admin.create.mock.calls[0][0];
    expect(saved.password).toBeUndefined();
    expect(saved.passwordHash).not.toContain("temporary123");
    expect(await bcrypt.compare("temporary123", saved.passwordHash)).toBe(true);
    expect(JSON.stringify(await res.json())).not.toContain("passwordHash");
  });

  it("POST returns 409 for a duplicate email", async () => {
    Admin.exists.mockResolvedValue({ _id: ID2 });
    const res = await admins.POST(jsonReq("/api/admin/admins", "POST", { name: "Sales", email: "sales@shop.com", password: "temporary123" }), ctx());
    expect(res.status).toBe(409);
    expect(Admin.create).not.toHaveBeenCalled();
  });

  it("POST rejects a short password", async () => {
    const res = await admins.POST(jsonReq("/api/admin/admins", "POST", { name: "Sales", email: "sales@shop.com", password: "short" }), ctx());
    expect(res.status).toBe(400);
  });

  it("DELETE refuses to remove yourself", async () => {
    const res = await adminById.DELETE(jsonReq(`/api/admin/admins/${ID}`, "DELETE"), ctx({ id: ID }));
    expect(res.status).toBe(400);
    expect(Admin.deleteOne).not.toHaveBeenCalled();
  });

  it("DELETE refuses to remove the last admin", async () => {
    Admin.countDocuments.mockResolvedValue(1);
    const res = await adminById.DELETE(jsonReq(`/api/admin/admins/${ID2}`, "DELETE"), ctx({ id: ID2 }));
    expect(res.status).toBe(400);
    expect(Admin.deleteOne).not.toHaveBeenCalled();
  });

  it("DELETE removes another admin", async () => {
    Admin.countDocuments.mockResolvedValue(2);
    const res = await adminById.DELETE(jsonReq(`/api/admin/admins/${ID2}`, "DELETE"), ctx({ id: ID2 }));
    expect(res.status).toBe(200);
    expect(Admin.deleteOne).toHaveBeenCalledWith({ _id: ID2 });
  });
});

describe("password change", () => {
  const admin = async () => ({ passwordHash: await bcrypt.hash("oldpassword", 4), save: vi.fn() } as any);

  it("rejects a wrong current password", async () => {
    const a = await admin();
    Admin.findById.mockResolvedValue(a);
    const res = await password.POST(jsonReq("/api/admin/password", "POST", { current: "wrongpass", next: "brandnewpass", confirm: "brandnewpass" }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/current password is incorrect/i);
    expect(a.save).not.toHaveBeenCalled();
  });

  it("saves a new hash when the current password is right", async () => {
    const a = await admin();
    Admin.findById.mockResolvedValue(a);
    const res = await password.POST(jsonReq("/api/admin/password", "POST", { current: "oldpassword", next: "brandnewpass", confirm: "brandnewpass" }), ctx());
    expect(res.status).toBe(200);
    expect(a.save).toHaveBeenCalled();
    expect(await bcrypt.compare("brandnewpass", a.passwordHash)).toBe(true);
    expect(await bcrypt.compare("oldpassword", a.passwordHash)).toBe(false);
  });

  it("rejects mismatched confirmation", async () => {
    const res = await password.POST(jsonReq("/api/admin/password", "POST", { current: "oldpassword", next: "brandnewpass", confirm: "other12345" }), ctx());
    expect(res.status).toBe(400);
  });
});
