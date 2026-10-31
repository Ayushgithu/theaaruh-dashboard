import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { UserModel } from "@/models/User";
import { HttpError, adminRoute, ok, readJson } from "@/lib/api-helpers";
import { creditWallet, debitWallet } from "@/lib/wallet";

const body = z.object({ amount: z.coerce.number().int().refine((n) => n !== 0, "Enter an amount").refine((n) => Math.abs(n) <= 100_000, "That amount is too large"), note: z.string().trim().min(3, "Add a short reason").max(120) });

/** Gift credit (positive) or take it back (negative). Every change is saved in the customer's wallet history. */
export const POST = adminRoute(async (req, { params }, session) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError("Customer not found.", 404);
  const v = body.parse(await readJson(req));
  await connectDB();
  const u: any = await UserModel.findById(id).select("guest walletBalance").lean(); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!u) throw new HttpError("Customer not found.", 404);
  if (u.guest) throw new HttpError("Guest shoppers do not have a wallet.", 400);
  const meta = { type: "adjustment" as const, note: v.note, by: session.name ?? "Admin" };
  if (v.amount > 0) return ok({ balance: await creditWallet(id, v.amount, meta) });
  if (!(await debitWallet(id, -v.amount, meta))) throw new HttpError(`The wallet only has ₹${Math.floor(u.walletBalance ?? 0)}.`, 400);
  return ok({ balance: Math.max(0, (u.walletBalance ?? 0) + v.amount) });
});
