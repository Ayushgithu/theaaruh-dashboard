import { VIDEO_MAX_BYTES, VIDEO_TYPES } from "./video-shared";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/** True once the two Cloudinary settings are added in Vercel. */
export const cloudinaryReady = Boolean(CLOUD && PRESET);

/** Uploads a video straight from the browser to Cloudinary (it never passes through our server, so there is no size trouble). Resolves to the video's https link. */
export function uploadVideoToCloudinary(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!CLOUD || !PRESET) return reject(new Error("Cloudinary is not set up yet. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in Vercel, then redeploy."));
    const type = file.type || "video/mp4";
    if (!VIDEO_TYPES.includes(type)) return reject(new Error("Please choose an MP4, WebM or MOV video."));
    if (file.size > VIDEO_MAX_BYTES) return reject(new Error(`This video is ${(file.size / 1024 / 1024).toFixed(0)} MB. Please keep it under ${VIDEO_MAX_BYTES / 1024 / 1024} MB.`));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", PRESET);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD}/video/upload`);
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