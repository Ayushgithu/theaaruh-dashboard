"use client";
import * as React from "react";
import type { AdminReview } from "@/lib/review-types";
import type { ReviewRequestRow, ReviewRequestSettings } from "@/lib/review-request-types";
import { cn } from "@/lib/utils";
import { ReviewAdmin } from "./review-admin";
import { ReviewRequests } from "./review-requests";

/** Dashboard → Reviews: the reviews themselves, and the "please review" messages to customers. */
export function ReviewsHub({ reviews, requests, settings }: { reviews: AdminReview[]; requests: ReviewRequestRow[]; settings: ReviewRequestSettings }) {
  const [tab, setTab] = React.useState<"reviews" | "ask">("reviews");
  const pending = reviews.filter((r) => r.status === "pending").length;
  const due = requests.filter((r) => !r.requested && +new Date(r.dueAt) <= Date.now()).length;
  const tabs = [["reviews", "Customer reviews", pending], ["ask", "Ask for reviews", due]] as const;
  return (
    <>
      <div role="tablist" aria-label="Reviews" className="mb-5 flex gap-6 border-b border-line">
        {tabs.map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("-mb-px flex min-h-11 items-center gap-2 border-b-2 text-sm font-semibold transition", tab === k ? "border-primary text-primary" : "border-transparent text-body hover:text-ink")}>
            {label}
            {n > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-5 text-white">{n}</span>}
          </button>
        ))}
      </div>
      {tab === "reviews" ? <ReviewAdmin initial={reviews} /> : <ReviewRequests rows={requests} settings={settings} />}
    </>
  );
}