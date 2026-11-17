import { HttpError, adminRoute, ok } from "@/lib/api-helpers";
import { saveImage, saveVideo } from "@/lib/images";

/** Images and videos go to Cloudinary; their details are saved in MongoDB and the returned URLs are what the site stores. */
export const POST = adminRoute(async (req) => {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new HttpError("Choose at least one file.", 400);
  if (files.length > 8) throw new HttpError("Upload up to 8 files at a time.", 400);
  const urls: string[] = [];
  for (const f of files) urls.push(f.type.startsWith("video/") ? await saveVideo(f) : await saveImage(f));
  return ok({ urls }, 201);
});
