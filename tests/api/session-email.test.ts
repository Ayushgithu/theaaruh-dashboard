// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
const send = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({ Resend: class { emails = { send: send }; } }));

import { getSession } from "@/lib/auth";
import { GET as session } from "@/app/api/admin/session/route";
import { emailFrom, resetEmailContent, sendPasswordResetEmail } from "@/lib/email";

afterEach(() => { vi.unstubAllEnvs(); send.mockReset(); });

describe("GET /api/admin/session (navbar: Admin vs Dashboard)", () => {
  it("signed in", async () => {
    vi.mocked(getSession).mockResolvedValue({ id: "a1", email: "o@shop.com", name: "Owner" });
    const res = await session();
    expect(await res.json()).toEqual({ signedIn: true, name: "Owner" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("signed out", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect(await (await session()).json()).toEqual({ signedIn: false, name: null });
  });
  it("treats a database/config error as signed out instead of failing", async () => {
    vi.mocked(getSession).mockRejectedValue(new Error("AUTH_SECRET missing"));
    const res = await session();
    expect(res.status).toBe(200);
    expect((await res.json()).signedIn).toBe(false);
  });
});

describe("Resend email", () => {
  const args = { to: "owner@shop.com", name: "Owner", link: "https://shop.example/?admin=reset&token=abc&email=owner%40shop.com" };

  it("sends through Resend with the reset link in html and text", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    vi.stubEnv("EMAIL_FROM", "The Aaruh <no-reply@shop.example>");
    send.mockResolvedValue({ data: { id: "1" }, error: null });
    expect(await sendPasswordResetEmail(args)).toBe(true);
    const msg = send.mock.calls[0][0];
    expect(msg).toMatchObject({ from: "The Aaruh <no-reply@shop.example>", to: "owner@shop.com", subject: expect.stringContaining("Reset") });
    expect(msg.html).toContain("token=abc");
    expect(msg.text).toContain(args.link);
  });

  it("defaults the sender to Resend's test address", () => {
    vi.stubEnv("EMAIL_FROM", "");
    expect(emailFrom()).toContain("onboarding@resend.dev");
  });

  it("throws when Resend reports an error (so it is logged)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    send.mockResolvedValue({ data: null, error: { message: "domain not verified" } });
    await expect(sendPasswordResetEmail(args)).rejects.toThrow("domain not verified");
  });

  it("without an API key it sends nothing and returns false", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await sendPasswordResetEmail(args)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("escapes HTML in the admin's name", () => {
    const { html } = resetEmailContent('<script>alert(1)</script>', "https://x.test/?a=1&b=2");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a=1&amp;b=2");
  });
});