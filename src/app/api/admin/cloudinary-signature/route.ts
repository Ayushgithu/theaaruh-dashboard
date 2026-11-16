import { adminRoute, ok } from "@/lib/api-helpers";
import { signVideoUpload } from "@/lib/cloudinary";

export const POST = adminRoute(async () => {
  return ok(signVideoUpload(Math.floor(Date.now() / 1000)));
});
