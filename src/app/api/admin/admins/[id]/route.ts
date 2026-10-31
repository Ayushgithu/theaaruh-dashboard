import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { AdminModel } from "@/models/Admin";
import { HttpError, adminRoute, ok } from "@/lib/api-helpers";

export const DELETE = adminRoute(async (_req, { params }, session) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Admin not found.", 404);
  if (id === session.id) throw new HttpError("You cannot remove your own account.", 400);
  await connectDB();
  if ((await AdminModel.countDocuments()) <= 1) throw new HttpError("At least one admin must remain.", 400);
  await AdminModel.deleteOne({ _id: id });
  return ok({ ok: true });
});
