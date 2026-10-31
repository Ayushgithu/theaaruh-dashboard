import mongoose from "mongoose";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";
import { applyReturnAction, returnActionSchema } from "@/lib/return-admin";

export const POST = adminRoute(async (req, { params }, session) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Return request not found.", 404);
  const action = returnActionSchema.parse(await readJson(req));
  return ok({ request: await applyReturnAction(id, action, session.name ?? "Admin") });
});
