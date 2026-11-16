import { videoSectionInput } from "@/lib/video-validation";
import { saveVideoSection } from "@/lib/repo-videos";
import { adminRoute, ok, readJson } from "@/lib/api-helpers";

export const PUT = adminRoute(async (req) => {
  const v = videoSectionInput.parse(await readJson(req));
  return ok({ section: await saveVideoSection(v) });
});