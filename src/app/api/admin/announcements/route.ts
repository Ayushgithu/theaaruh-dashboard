import { connectDB } from "@/lib/db";
import { AnnouncementModel } from "@/models/Announcement";
import { announcementInput } from "@/lib/validation";
import { adminRoute, ok, readJson } from "@/lib/api-helpers";
import { toAnnouncement } from "@/lib/repo";

export const POST = adminRoute(async (req) => {
  const v = announcementInput.parse(await readJson(req));
  await connectDB();
  const doc = await AnnouncementModel.create(v);
  return ok(toAnnouncement(doc.toObject()), 201);
});
