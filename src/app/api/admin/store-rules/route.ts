import { adminRoute, ok, readJson } from "@/lib/api-helpers";
import { getRules, saveRules } from "@/lib/settings";
import { storeRulesSchema } from "@/lib/validation";
import { mergeRules } from "@/lib/rules";

export const GET = adminRoute(async () => ok({ rules: await getRules(true) }));

export const PUT = adminRoute(async (req) => {
  const v = storeRulesSchema.parse(await readJson(req));
  for (const r of v.sizeAdvisor.rows) if (r.minHeight > r.maxHeight || r.minWeight > r.maxWeight) return Response.json({ error: `Size ${r.size}: the minimum cannot be more than the maximum.` }, { status: 400 });
  if (v.saleTimer.active && !(v.saleTimer.endsAt && Date.parse(v.saleTimer.endsAt) > Date.now())) return Response.json({ error: "Pick a future end date and time for the sale countdown (or switch it off)." }, { status: 400 });
  if (v.cod.advance > 0 && v.cod.advance >= v.shipping.freeAbove && v.shipping.freeAbove > 0) { /* allowed; advance is capped to less than the order total at checkout */ }
  return ok({ rules: await saveRules(mergeRules(v as never)) });
});
