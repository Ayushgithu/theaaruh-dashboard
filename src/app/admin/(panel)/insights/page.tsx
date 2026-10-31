import Link from "next/link";
import { getInsights } from "@/lib/insights";
import { InsightsView } from "@/components/admin/insights-view";
import { AdminPageHeader } from "@/components/admin/shell";
import { cn } from "@/lib/utils";

export const metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90];

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const n = Number((await searchParams).days);
  const days = RANGES.includes(n) ? n : 30;
  const data = await getInsights(days);
  return (
    <>
      <AdminPageHeader title="Insights" description="What is selling, which sizes to stitch more of, and why things come back."
        action={<div role="tablist" aria-label="Period" className="flex gap-1 rounded-xl bg-card p-1 shadow-card ring-1 ring-line">{RANGES.map((r) => <Link key={r} role="tab" aria-selected={r === days} href={`/admin/insights?days=${r}`} className={cn("min-h-10 rounded-lg px-3.5 py-2.5 text-sm font-medium", r === days ? "bg-primary text-white" : "text-body hover:bg-surface")}>Last {r} days</Link>)}</div>} />
      <InsightsView data={data} />
    </>
  );
}
