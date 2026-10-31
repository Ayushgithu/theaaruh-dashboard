// @vitest-environment node
import bcrypt from "bcryptjs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn(), createSession: vi.fn(), destroySession: vi.fn() }));
vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/models/Admin", () => ({ AdminModel: { findOne: vi.fn() } }));

import { createSession, destroySession } from "@/lib/auth";
import { AdminModel } from "@/models/Admin";
import { POST as login } from "@/app/api/admin/login/route";
import { POST as logout } from "@/app/api/admin/logout/route";
import { ID, ctx, jsonReq } from "./utils";

const findOne = (AdminModel as unknown as { findOne: ReturnType<typeof vi.fn> }).findOne;
let hash = "";
beforeAll(async () => { hash = await bcrypt.hash("secret123", 4); });
beforeEach(() => findOne.mockResolvedValue({ _id: ID, email: "owner@shop.com", name: "Owner", passwordHash: hash }));

const attempt = (email: string, password: string, ip?: string) =>
  login(jsonReq("/api/admin/login", "POST", { email, password }, ip ? { "x-forwarded-for": ip } : {}), ctx());

describe("POST /api/admin/login", () => {
  it("signs in with correct credentials and creates a session", async () => {
    const res = await attempt("owner@shop.com", "secret123");
    expect(res.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith({ id: ID, email: "owner@shop.com", name: "Owner" });
  });

  it("looks the email up case-insensitively", async () => {
    await attempt("Owner@Shop.COM", "secret123");
    expect(findOne).toHaveBeenCalledWith({ email: "owner@shop.com" });
  });

  it("wrong password → 401 with a generic message, no session", async () => {
    const res = await attempt("owner@shop.com", "wrong-password");
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Incorrect email or password.");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("unknown email → the same 401 (does not reveal which emails exist)", async () => {
    findOne.mockResolvedValue(null);
    const res = await attempt("nobody@shop.com", "secret123");
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Incorrect email or password.");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("missing fields → 400", async () => {
    const res = await login(jsonReq("/api/admin/login", "POST", {}), ctx());
    expect(res.status).toBe(400);
  });

  it("never returns the password hash", async () => {
    const res = await attempt("owner@shop.com", "secret123");
    expect(JSON.stringify(await res.json())).not.toContain("$2");
  });

  it("blocks brute force: 429 after 8 attempts for the same email", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await attempt("victim@shop.com", `guess-${i}`, "203.0.113.9")).status);
    expect(statuses.slice(0, 8).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(8)).toEqual([429, 429]);
  });
});

describe("POST /api/admin/logout", () => {
  it("destroys the session", async () => {
    const res = await logout(jsonReq("/api/admin/logout", "POST", {}), ctx());
    expect(res.status).toBe(200);
    expect(destroySession).toHaveBeenCalled();
  });
});
