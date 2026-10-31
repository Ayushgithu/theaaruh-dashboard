import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { AnnouncementModel } from "@/models/Announcement";
import { announcementInput } from "@/lib/validation";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";
import { toAnnouncement } from "@/lib/repo";

const load = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Message not found.", 404);
  await connectDB();
  const doc = await AnnouncementModel.findById(id);
  if (!doc) throw new HttpError("Message not found.", 404);
  return doc;
};

export const PUT = adminRoute(async (req, { params }) => {
  const doc = await load((await params).id);
  const body = await readJson(req);
  const toggle = z.object({ active: z.boolean() }).safeParse(body); // quick on/off switch sends only { active }
  if (toggle.success && Object.keys(body).length === 1) doc.active = toggle.data.active;
  else doc.set(announcementInput.parse(body));
  await doc.save();
  return ok(toAnnouncement(doc.toObject()));
});

export const DELETE = adminRoute(async (_req, { params }) => {
  const doc = await load((await params).id);
  await doc.deleteOne();
  return ok({ ok: true });
});
