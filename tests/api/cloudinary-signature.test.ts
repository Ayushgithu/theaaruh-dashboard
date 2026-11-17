// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signVideoUpload: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/user-auth", () => ({ getUserSession: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({ signVideoUpload: mocks.signVideoUpload }));

import { POST } from "@/app/api/admin/cloudinary-signature/route";

const call = () => POST(new Request("http://localhost/api/admin/cloudinary-signature", { method: "POST" }), { params: Promise.resolve({}) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ id: "admin" });
  mocks.signVideoUpload.mockReturnValue({
    cloudName: "shop",
    apiKey: "public-key",
    folder: "store/videos",
    timestamp: 123,
    signature: "signed-value",
  });
});

describe("Cloudinary video upload signature", () => {
  it("returns signed upload details to an authenticated admin without exposing the API secret", async () => {
    const response = await call();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cloudName: "shop",
      apiKey: "public-key",
      folder: "store/videos",
      timestamp: 123,
      signature: "signed-value",
    });
    expect(mocks.signVideoUpload).toHaveBeenCalledWith(expect.any(Number));
  });

  it("does not issue an upload signature to unauthenticated requests", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(401);
    expect(mocks.signVideoUpload).not.toHaveBeenCalled();
  });
});
