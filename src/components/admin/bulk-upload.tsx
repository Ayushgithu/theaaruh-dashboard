"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { postJson } from "@/lib/api";
import { BULK_MAX, parseCsv, rowToProduct, tableToRows, TEMPLATE_CSV, type RawRow } from "@/lib/bulk";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/drawer";

export function BulkUpload({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<RawRow[]>([]);
  const [file, setFile] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ created: number; failed: { row: number; name: string; error: string }[] } | null>(null);

  const checked = React.useMemo(() => rows.map((r) => ({ r, res: rowToProduct(r) })), [rows]);
  const good = checked.filter((c) => !c.res.error).length;

  const reset = () => { setRows([]); setFile(""); setResult(null); };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setResult(null);
    try {
      let table: string[][];
      if (/\.xlsx$/i.test(f.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        table = (await readSheet(f)).map((r) => r.map((c) => (c == null ? "" : String(c))));
      } else if (/\.(csv|txt)$/i.test(f.name)) table = parseCsv(await f.text());
      else { toast.error("Please choose a .xlsx or .csv file", { description: "In Excel: File → Save As → CSV works too." }); return; }
      const parsed = tableToRows(table);
      if (!parsed.length) { toast.error("No products found", { description: "The first row must be the column names. Download the template to see the format." }); return; }
      if (parsed.length > BULK_MAX) { toast.error(`Too many rows (${parsed.length})`, { description: `Upload ${BULK_MAX} products or fewer at a time.` }); return; }
      setRows(parsed); setFile(f.name);
    } catch { toast.error("Could not read that file", { description: "Make sure it is a valid Excel (.xlsx) or CSV file." }); }
  };

  const template = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "products-template.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const upload = async () => {
    setBusy(true);
    try {
      const res = await postJson<{ created: number; failed: { row: number; name: string; error: string }[] }>("/api/admin/products/bulk", { rows });
      setResult(res);
      if (res.created) { toast.success(`${res.created} product${res.created > 1 ? "s" : ""} added`, { description: "Add photos to each from the product list." }); router.refresh(); onDone?.(); }
    } catch (e) { toast.error("Upload failed", { description: e instanceof Error ? e.message : "Please try again." }); }
    setBusy(false);
  };

  return (
    <>
      <Button variant="outline" onClick={() => { reset(); setOpen(true); }}><FileSpreadsheet className="h-4 w-4" /> Bulk upload</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Bulk upload products" wide>
        <div className="space-y-4">
          <p className="text-sm">Add up to {BULK_MAX} products from an Excel or CSV file. Photos are added afterwards from each product. Sizes look like <code className="rounded bg-surface px-1">S:4,M:6,L:6</code> (size:pieces) and colours like <code className="rounded bg-surface px-1">Maroon:#8c1d40,Green</code>.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="soft" onClick={template}><Download className="h-4 w-4" /> Download template</Button>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-line bg-card px-4 text-sm font-semibold text-ink hover:border-primary">
              <FileSpreadsheet className="h-4 w-4 text-primary" /> {file || "Choose .xlsx or .csv file"}
              <input type="file" accept=".xlsx,.csv,.txt" className="sr-only" aria-label="Choose spreadsheet" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>

          {checked.length > 0 && !result && (
            <>
              <p className="text-sm"><strong className="text-ink">{good}</strong> of {checked.length} rows are ready{checked.length - good > 0 && <> · <strong className="text-red-600">{checked.length - good}</strong> have problems (they will be skipped)</>}.</p>
              <div className="max-h-72 overflow-auto rounded-sm border border-line">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="sticky top-0 bg-surface text-xs"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Collection</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Check</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {checked.map(({ r, res }, i) => (
                      <tr key={i}><td className="px-3 py-2">{i + 2}</td><td className="px-3 py-2 font-medium text-ink">{r.name}</td><td className="px-3 py-2">{r.category}</td><td className="px-3 py-2">{r.price}</td>
                        <td className="px-3 py-2">{res.error ? <span className="flex items-center gap-1 text-xs font-medium text-red-600"><XCircle className="h-4 w-4 shrink-0" />{res.error}</span> : <span className="flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />OK</span>}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3"><Button variant="outline" onClick={reset}>Choose another file</Button><Button disabled={busy || good === 0} onClick={upload}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</> : `Add ${good} product${good === 1 ? "" : "s"}`}</Button></div>
            </>
          )}

          {result && (
            <div role="status" className="space-y-2 rounded-sm bg-surface p-4 text-sm">
              <p className="font-semibold text-ink">{result.created} added{result.failed.length > 0 && `, ${result.failed.length} skipped`}.</p>
              {result.failed.map((f) => <p key={f.row} className="text-xs text-red-600">Row {f.row} {f.name && `(${f.name})`}: {f.error}</p>)}
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
