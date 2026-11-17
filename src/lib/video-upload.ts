import { VIDEO_MAX_BYTES, VIDEO_TYPES } from "./video-shared";
import { request } from "./api";

type SignedUpload = {
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  signature: string;
};

/** Requests a short-lived signature, then uploads directly to Cloudinary so large files bypass the app server. */
export async function uploadVideoToCloudinary(file: File, onProgress: (pct: number) => void): Promise<string> {
  const type = file.type || "video/mp4";
  if (!VIDEO_TYPES.includes(type)) throw new Error("Please choose an MP4, WebM or MOV video.");
  if (file.size > VIDEO_MAX_BYTES) throw new Error(`This video is ${(file.size / 1024 / 1024).toFixed(0)} MB. Please keep it under ${VIDEO_MAX_BYTES / 1024 / 1024} MB.`);
  const signed = await request<SignedUpload>("/api/admin/cloudinary-signature", { method: "POST" });
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("api_key", signed.apiKey);
    fd.append("folder", signed.folder);
    fd.append("timestamp", String(signed.timestamp));
    fd.append("signature", signed.signature);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/video/upload`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => reject(new Error("Could not reach Cloudinary. Check your internet connection and try again."));
    xhr.onload = () => {
      let data: { secure_url?: string; error?: { message?: string } } = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data.secure_url);
      else reject(new Error(data.error?.message ?? "Cloudinary did not accept this video."));
    };
    xhr.send(fd);
  });
}