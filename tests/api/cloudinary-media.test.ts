// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
const cl = vi.hoisted(() => ({ configured: true, upload: vi.fn(), destroy: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({ cloudinaryConfigured: () => cl.configured, uploadToCloudinary: cl.upload, deleteFromCloudinary: cl.destroy }));
vi.mock("@/models/Image", () => ({ ImageModel: { create: vi.fn(), findById: vi.fn(), find: vi.fn(), deleteMany: vi.fn() } }));

import { ImageModel } from "@/models/Image";
import { deleteImages, saveImage, saveVideo } from "@/lib/images";
import { GET as imageGet } from "@/app/api/images/[id]/route";
import { GET as videoGet } from "@/app/api/videos/[id]/route";

const Img = ImageModel as any;
const ID = "64b7f0c2a1b2c3d4e5f60001";
const png = async () => new File([new Uint8Array(await sharp({ create: { width: 20, height: 20, channels: 3, background: "#f00" } }).png().toBuffer())], "a.png", { type: "image/png" });

beforeEach(() => {
  vi.clearAllMocks(); cl.configured = true;
  Img.create.mockResolvedValue({ _id: ID }); cl.destroy.mockResolvedValue(undefined);
  cl.upload.mockResolvedValue({ secure_url: "https://res.cloudinary.com/x/image/upload/a.webp", public_id: "store/images/a", bytes: 123, width: 20, height: 20 });
});

describe("saving media", () => {
  it("uploads the image to Cloudinary, saves its details in MongoDB and returns the site address", async () => {
    expect(await saveImage(await png())).toBe(`/api/images/${ID}`);
    expect(cl.upload.mock.calls[0][1]).toBe("image");
    expect(Img.create).toHaveBeenCalledWith(expect.objectContaining({ url: "https://res.cloudinary.com/x/image/upload/a.webp", publicId: "store/images/a", resourceType: "image" }));
    expect(Img.create.mock.calls[0][0].data).toBeUndefined();
  });
  it("falls back to MongoDB bytes when Cloudinary is not configured", async () => {
    cl.configured = false;
    await saveImage(await png());
    expect(cl.upload).not.toHaveBeenCalled();
    expect(Buffer.isBuffer(Img.create.mock.calls[0][0].data)).toBe(true);
  });
  it("cleans up the Cloudinary file if saving the record fails", async () => {
    Img.create.mockRejectedValue(new Error("db down"));
    await expect(saveImage(await png())).rejects.toThrow("db down");
    expect(cl.destroy).toHaveBeenCalledWith("store/images/a", "image");
  });
  it("saves a video and returns a /api/videos address", async () => {
    cl.upload.mockResolvedValue({ secure_url: "https://res.cloudinary.com/x/video/upload/v.mp4", public_id: "store/videos/v", bytes: 9, duration: 4 });
    expect(await saveVideo(new File([new Uint8Array(10)], "v.mp4", { type: "video/mp4" }))).toBe(`/api/videos/${ID}`);
    expect(Img.create).toHaveBeenCalledWith(expect.objectContaining({ resourceType: "video", duration: 4 }));
  });
  it("rejects videos without Cloudinary, non-videos and oversized videos", async () => {
    const v = new File([new Uint8Array(10)], "v.mp4", { type: "video/mp4" });
    cl.configured = false;
    await expect(saveVideo(v)).rejects.toMatchObject({ status: 503 });
    cl.configured = true;
    await expect(saveVideo(new File(["x"], "a.txt", { type: "text/plain" }))).rejects.toMatchObject({ status: 400 });
    const big = new File([new Uint8Array(1)], "b.mp4", { type: "video/mp4" }); Object.defineProperty(big, "size", { value: 60 * 1024 * 1024 });
    await expect(saveVideo(big)).rejects.toMatchObject({ status: 413 });
  });
});

describe("showing media from MongoDB", () => {
  const get = (h: typeof imageGet, id = ID) => h(new Request("http://x"), { params: Promise.resolve({ id }) });
  it("redirects an image address to its Cloudinary URL", async () => {
    Img.findById.mockResolvedValue({ url: "https://res.cloudinary.com/x/image/upload/v1/a.webp", resourceType: "image" });
    const r = await get(imageGet);
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://res.cloudinary.com/x/image/upload/f_auto,q_auto/v1/a.webp");
  });
  it("still serves older images stored as bytes", async () => {
    Img.findById.mockResolvedValue({ data: Buffer.from("abc"), contentType: "image/webp" });
    const r = await get(imageGet);
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("abc");
  });
  it("does not mix up images and videos, and 404s bad or unknown ids", async () => {
    Img.findById.mockResolvedValue({ url: "https://x/v.mp4", resourceType: "video" });
    expect((await get(imageGet)).status).toBe(404);
    expect((await get(videoGet)).status).toBe(302);
    expect((await get(imageGet, "nope")).status).toBe(404);
    Img.findById.mockResolvedValue(null);
    expect((await get(videoGet)).status).toBe(404);
  });
});

describe("deleteImages", () => {
  it("removes the Cloudinary files and the MongoDB records", async () => {
    Img.find.mockReturnValue({ select: () => ({ lean: async () => [{ publicId: "store/images/a", resourceType: "image" }, { publicId: "store/videos/v", resourceType: "video" }] }) });
    await deleteImages([`/api/images/${ID}`, `/api/videos/64b7f0c2a1b2c3d4e5f60002`, "https://youtube.com/x", null]);
    expect(cl.destroy).toHaveBeenCalledWith("store/images/a", "image");
    expect(cl.destroy).toHaveBeenCalledWith("store/videos/v", "video");
    expect(Img.deleteMany).toHaveBeenCalledWith({ _id: { $in: [ID, "64b7f0c2a1b2c3d4e5f60002"] } });
  });
});
