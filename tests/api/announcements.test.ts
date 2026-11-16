// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn(), createSession: vi.fn(), destroySession: vi.fn() }));
vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/models/Announcement", () => ({ AnnouncementModel: { create: vi.fn(), findById: vi.fn() } }));

import { getSession } from "@/lib/auth";
import { AnnouncementModel } from "@/models/Announcement";
import { POST } from "@/app/api/admin/announcements/route";
import { DELETE, PUT } from "@/app/api/admin/announcements/[id]/route";
import { ID, ctx, jsonReq } from "./utils";


const Model = AnnouncementModel as any;
beforeEach(() => vi.mocked(getSession).mockResolvedValue({ id: "a1", email: "o@shop.com", name: "Owner" }));

describe("POST /api/admin/announcements (create)", () => {
  it("creates a message and returns it", async () => {
    Model.create.mockImplementation(async (d: object) => ({ toObject: () => ({ _id: ID, ...d }) }));
    const res = await POST(jsonReq("/api/admin/announcements", "POST", { text: "Free delivery on laptops", href: "/laptops", active: true }), ctx());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: ID, text: "Free delivery on laptops", href: "/laptops", active: true });
  });
  it("400 for text that is too short; nothing saved", async () => {
    const res = await POST(jsonReq("/api/admin/announcements", "POST", { text: "ab", active: true }), ctx());
    expect(res.status).toBe(400);
    expect(Model.create).not.toHaveBeenCalled();
  });
  it("400 for a javascript: link", async () => {
    const res = await POST(jsonReq("/api/admin/announcements", "POST", { text: "Click here now", href: "javascript:alert(1)", active: true }), ctx());
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/admin/announcements/:id (update)", () => {
  const doc = () => ({ active: true, set: vi.fn(), save: vi.fn(), toObject: () => ({ _id: ID, text: "Free delivery", active: false }) });

  it("{ active } alone is a quick on/off toggle", async () => {
    const d = doc();
    Model.findById.mockResolvedValue(d);
    const res = await PUT(jsonReq(`/api/admin/announcements/${ID}`, "PUT", { active: false }), ctx({ id: ID }));
    expect(res.status).toBe(200);
    expect(d.active).toBe(false);
    expect(d.set).not.toHaveBeenCalled();
    expect(d.save).toHaveBeenCalled();
  });
  it("a full body edits the text", async () => {
    const d = doc();
    Model.findById.mockResolvedValue(d);
    await PUT(jsonReq(`/api/admin/announcements/${ID}`, "PUT", { text: "New text for the bar", active: true }), ctx({ id: ID }));
    expect(d.set).toHaveBeenCalledWith({ text: "New text for the bar", href: undefined, active: true });
  });
  it("404 for a malformed id or a missing message", async () => {
    expect((await PUT(jsonReq("/x", "PUT", { active: true }), ctx({ id: "bad" }))).status).toBe(404);
    Model.findById.mockResolvedValue(null);
    expect((await PUT(jsonReq("/x", "PUT", { active: true }), ctx({ id: ID }))).status).toBe(404);
  });
});

describe("DELETE /api/admin/announcements/:id", () => {
  it("deletes the message", async () => {
    const d = { deleteOne: vi.fn() };
    Model.findById.mockResolvedValue(d);
    const res = await DELETE(jsonReq(`/api/admin/announcements/${ID}`, "DELETE"), ctx({ id: ID }));
    expect(res.status).toBe(200);
    expect(d.deleteOne).toHaveBeenCalled();
  });
});
