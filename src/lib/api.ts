/* Browser helpers for talking to our own API routes. */

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown> = {}) { super(message); }
}

export async function request<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("Could not reach the server. Check your internet connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? (res.status === 413 ? "The photo is too large. Please choose a smaller photo." : "Something went wrong."), res.status, data as Record<string, unknown>);
  return data as T;
}

export const postJson = <T = unknown>(url: string, body: unknown, method = "POST") =>
  request<T>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const submitContact = (data: { name: string; phone: string; message: string }) => postJson("/api/contact", data);

/** Phone photos are often 3-6 MB. Shrinking them here (max 1600px, WebP) keeps every upload small and fast. */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

/** Uploads photos one by one (each request stays far below the server's size limit, so 5+ photos work). */
export async function uploadImages(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const f of files) {
    const fd = new FormData();
    fd.append("files", await shrink(f));
    const res = await request<{ urls: string[] }>("/api/admin/upload", { method: "POST", body: fd });
    urls.push(...res.urls);
  }
  return urls;
}

/** Uploads one video to Cloudinary (through the server) and returns its /api/videos/<id> URL. */
export async function uploadVideo(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("files", file);
  const { urls } = await request<{ urls: string[] }>("/api/admin/upload", { method: "POST", body: fd });
  return urls[0];
}