"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ count }: { count: number }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line bg-card p-4 shadow-card print:hidden">
      <p className="text-sm"><strong className="text-ink">{count}</strong> order{count === 1 ? "" : "s"} · each prints a packing slip and a shipping label on its own A4 page. Use “Save as PDF” if you want a file.</p>
      <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
    </div>
  );
}
