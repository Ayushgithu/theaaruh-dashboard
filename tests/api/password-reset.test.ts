// @vitest-environment node
import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pending = vi.hoisted(() => [] as Promise<unknown>[]);
vi.mock("next/server", () => ({ after: (fn: () => unknown) => { pending.push(Promise.resolve().then(fn)); } }));
vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: vi.fn(async () => true) }));
vi.mock("@/models/Admin", () => ({ AdminModel: { findOne: vi.fn() } }));

import { sendPasswordResetEmail } from "@/lib/email";
import { AdminModel } from "@/models/Admin";
import { sha256 } from "@/lib/tokens";
import { POST as forgot } from "@/app/api/admin/forgot-password/route";
import { POST as reset } from "@/app/api/admin/reset-password/route";
import { ctx, freshIp, jsonReq } from "./utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const findOne = (AdminModel as any).findOne as ReturnType<typeof vi.fn>;
const flush = async () => { await Promise.all(pending.splice(0)); };
let n = 0;
const uniqueEmail = () => `owner${++n}@shop.com`;

const adminDoc = (email: string) => ({ email, name: "Store Owner", save: vi.fn(), resetTokenHash: undefined as string | undefined, resetExpires: undefined as Date | undefined });
const tokenFromLink = (link: string) => new URL(link).searchParams.get("token")!;

beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_DASHBOARD_URL", "https://admin.example"); });
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/admin/forgot-password", () => {
  it("emails a reset link built from NEXT_PUBLIC_DASHBOARD_URL and stores only the token's hash (1 hour)", async () => {
    const email = uniqueEmail();
    const doc = adminDoc(email);
    findOne.mockResolvedValue(doc);
    const before = Date.now();
    const res = await forgot(jsonReq("/api/admin/forgot-password", "POST", { email }), ctx());
    await flush();

    expect(res.status).toBe(200);
    const call = vi.mocked(sendPasswordResetEmail).mock.calls[0][0];
    expect(call.to).toBe(email);
    expect(call.link.startsWith("https://admin.example/login?mode=reset&token=")).toBe(true);
    expect(new URL(call.link).searchParams.get("email")).toBe(email);

    const token = tokenFromLink(call.link);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(doc.resetTokenHash).toBe(sha256(token)); // hash stored…
    expect(doc.resetTokenHash).not.toBe(token); // …never the token itself
    const ttl = doc.resetExpires!.getTime() - before;
    expect(ttl).toBeGreaterThan(59 * 60_000);
    expect(ttl).toBeLessThanOrEqual(61 * 60_000);
    expect(doc.save).toHaveBeenCalled();
  });

  it("gives the identical answer for an unknown email (cannot discover which emails are admins)", async () => {
    const known = uniqueEmail();
    findOne.mockResolvedValueOnce(adminDoc(known));
    const a = await forgot(jsonReq("/api/admin/forgot-password", "POST", { email: known }), ctx());
    findOne.mockResolvedValueOnce(null);
    const b = await forgot(jsonReq("/api/admin/forgot-password", "POST", { email: uniqueEmail() }), ctx());
    await flush();
    expect(b.status).toBe(a.status);
    expect(await b.json()).toEqual(await a.json());
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1); // only the real admin got an email
  });

  it("looks the email up in lower case", async () => {
    findOne.mockResolvedValue(null);
    await forgot(jsonReq("/api/admin/forgot-password", "POST", { email: "Mixed.Case@Shop.COM" }), ctx());
    expect(findOne).toHaveBeenCalledWith({ email: "mixed.case@shop.com" });
  });

  it("400 for an invalid email", async () => {
    const res = await forgot(jsonReq("/api/admin/forgot-password", "POST", { email: "nope" }), ctx());
    expect(res.status).toBe(400);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("rate-limits: 429 on the 4th request for the same email", async () => {
    const email = uniqueEmail();
    findOne.mockResolvedValue(null);
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) codes.push((await forgot(jsonReq("/api/admin/forgot-password", "POST", { email }), ctx())).status);
    expect(codes).toEqual([200, 200, 200, 429]);
  });

  it("a forged Host header cannot poison the link (uses the configured dashboard URL)", async () => {
    const email = uniqueEmail();
    findOne.mockResolvedValue(adminDoc(email));
    const req = new Request("http://evil.example/api/admin/forgot-password", {
      method: "POST", headers: { "content-type": "application/json", host: "evil.example", "x-forwarded-host": "evil.example", "x-forwarded-for": freshIp() },
      body: JSON.stringify({ email }),
    });
    await forgot(req, ctx());
    await flush();
    const link = vi.mocked(sendPasswordResetEmail).mock.calls[0][0].link;
    expect(link).toContain("https://admin.example/");
    expect(link).not.toContain("evil.example");
  });

  it("in production without NEXT_PUBLIC_DASHBOARD_URL, no email is sent (never trusts request headers)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DASHBOARD_URL", "");
    const email = uniqueEmail();
    findOne.mockResolvedValue(adminDoc(email));
    const res = await forgot(jsonReq("/api/admin/forgot-password", "POST", { email }), ctx());
    await flush();
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("an email-provider failure is not shown to the visitor", async () => {
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error("Resend: domain not verified"));
    const email = uniqueEmail();
    findOne.mockResolvedValue(adminDoc(email));
    const res = await forgot(jsonReq("/api/admin/forgot-password", "POST", { email }), ctx());
    await flush();
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toContain("Resend");
  });
});

describe("POST /api/admin/reset-password", () => {
  const TOKEN = "c".repeat(64);
  const body = { email: "owner@shop.com", token: TOKEN, password: "brandnewpass" };
  const doc = () => ({ passwordHash: "old", resetTokenHash: sha256(TOKEN), resetExpires: new Date(Date.now() + 1000), save: vi.fn() });
  const lookup = (d: unknown) => findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(d) });

  it("sets the new password, clears the token (single use) and saves", async () => {
    const d = doc();
    lookup(d);
    const res = await reset(jsonReq("/api/admin/reset-password", "POST", body), ctx());
    expect(res.status).toBe(200);
    expect(await bcrypt.compare("brandnewpass", d.passwordHash)).toBe(true);
    expect(d.resetTokenHash).toBeUndefined();
    expect(d.resetExpires).toBeUndefined();
    expect(d.save).toHaveBeenCalled();
  });

  it("looks up by the HASH of the token and only if it has not expired", async () => {
    lookup(doc());
    await reset(jsonReq("/api/admin/reset-password", "POST", body), ctx());
    const q = findOne.mock.calls[0][0];
    expect(q.email).toBe("owner@shop.com");
    expect(q.resetTokenHash).toBe(sha256(TOKEN));
    expect(q.resetTokenHash).not.toBe(TOKEN);
    expect(q.resetExpires.$gt).toBeInstanceOf(Date);
  });

  it("400 with a generic message for a wrong/used/expired token", async () => {
    lookup(null);
    const res = await reset(jsonReq("/api/admin/reset-password", "POST", body), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid or has expired/);
  });

  it("400 for a malformed token (never queries the database)", async () => {
    const res = await reset(jsonReq("/api/admin/reset-password", "POST", { ...body, token: "short" }), ctx());
    expect(res.status).toBe(400);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("400 with a clear message for a weak password", async () => {
    const res = await reset(jsonReq("/api/admin/reset-password", "POST", { ...body, password: "short" }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Use at least 8 characters");
  });

  it("rate-limits guessing: 429 after 10 attempts from one IP", async () => {
    lookup(null);
    const ip = freshIp();
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await reset(jsonReq("/api/admin/reset-password", "POST", body, { "x-forwarded-for": ip }), ctx())).status);
    expect(codes.slice(0, 10).every((c) => c === 400)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429]);
  });
});
