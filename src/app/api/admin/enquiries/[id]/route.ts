import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { EnquiryModel } from "@/models/Enquiry";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";

export const PATCH = adminRoute(async (req, { params }) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Enquiry not found.", 404);
  const { status } = z.object({ status: z.enum(["new", "contacted", "closed"]) }).parse(await readJson(req));
  await connectDB();
  const res = await EnquiryModel.updateOne({ _id: id }, { status });
  if (!res.matchedCount) throw new HttpError("Enquiry not found.", 404);
  return ok({ ok: true });
});
