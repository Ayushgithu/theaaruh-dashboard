import { HttpError, adminRoute, ok } from "@/lib/api-helpers";
import { saveImage } from "@/lib/images";

export const POST = adminRoute(async (req) => {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new HttpError("Choose at least one image.", 400);
  if (files.length > 8) throw new HttpError("Upload up to 8 images at a time.", 400);
  const urls: string[] = [];
  for (const f of files) urls.push(await saveImage(f));
  return ok({ urls }, 201);
});
