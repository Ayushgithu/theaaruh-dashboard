"use client";
import * as React from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Ruler, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { SizeGuideItem } from "@/lib/size-guide-types";
import { postJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/drawer";
import { AdminPageHeader } from "./shell";

type Draft = Omit<SizeGuideItem, "id" | "slug" | "order">;

function GuideForm({ item, onSave, onCancel }: { item: SizeGuideItem | null; onSave: (d: Draft) => Promise<boolean>; onCancel: () => void }) {
  const [name, setName] = React.useState(item?.name ?? "");
  const [unit, setUnit] = React.useState(item?.unit ?? "inches");
  const [columns, setColumns] = React.useState<string[]>(item?.columns ?? ["Size", "Bust", "Waist"]);
  const [rows, setRows] = React.useState<string[][]>(item?.rows?.length ? item.rows : [["", "", ""]]);
  const [tips, setTips] = React.useState((item?.tips ?? []).join("\n"));
  const [active, setActive] = React.useState(item?.active ?? true);
  const [error, setError] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);

  const setCol = (i: number, v: string) => setColumns((c) => c.map((x, j) => (j === i ? v : x)));
  const addCol = () => { setColumns((c) => [...c, ""]); setRows((r) => r.map((row) => [...row, ""])); };
  const delCol = (i: number) => { setColumns((c) => c.filter((_, j) => j !== i)); setRows((r) => r.map((row) => row.filter((_, j) => j !== i))); };
  const setCell = (ri: number, ci: number, v: string) => setRows((r) => r.map((row, i) => (i === ri ? row.map((x, j) => (j === ci ? v : x)) : row)));
  const addRow = () => setRows((r) => [...r, columns.map(() => "")]);
  const delRow = (i: number) => setRows((r) => r.filter((_, j) => j !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Enter a name for this chart, e.g. Women or Kids");
    if (columns.length < 2 || columns.some((c) => !c.trim())) return setError("Every column needs a heading (at least 2 columns)");
    const cleanRows = rows.filter((r) => r.some((c) => c.trim())); // drop rows left completely empty
    if (cleanRows.length === 0) return setError("Add at least one row");
    setError("");
    setBusy(true);
    try {
      await onSave({ name: name.trim(), unit: unit.trim() || "inches", columns: columns.map((c) => c.trim()), rows: cleanRows.map((r) => r.map((c) => c.trim())), tips: tips.split("\n").map((t) => t.trim()).filter(Boolean), active });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Chart name" hint="Shown as the tab, e.g. Women, Kids."><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kids" maxLength={40} /></Field>
        <Field label="Measurement unit" hint="Shown under the table, e.g. inches or cm."><Input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} /></Field>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-ink">Table</p>
        <p className="mb-3 text-xs">The first column is the size or age group (for example “M” or “3-4 Y”). Rename the headings, add or remove columns and rows as you like.</p>
        <div className="overflow-x-auto rounded-sm border border-line">
          <table className="w-full min-w-[30rem] text-sm">
            <thead className="bg-surface">
              <tr>
                {columns.map((c, i) => (
                  <th key={i} className="p-1.5 align-top">
                    <div className="flex items-center gap-1">
                      <Input aria-label={`Column ${i + 1} heading`} value={c} onChange={(e) => setCol(i, e.target.value)} placeholder="Heading" className="font-semibold" maxLength={24} />
                      {columns.length > 2 && <Button type="button" variant="ghost" size="icon" aria-label={`Remove column ${c || i + 1}`} onClick={() => delCol(i)}><X className="h-4 w-4" /></Button>}
                    </div>
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-t border-line">
                  {row.map((cell, ci) => (
                    <td key={ci} className="p-1.5"><Input aria-label={`Row ${ri + 1}, ${columns[ci] || `column ${ci + 1}`}`} value={cell} onChange={(e) => setCell(ri, ci, e.target.value)} maxLength={24} /></td>
                  ))}
                  <td className="p-1.5"><Button type="button" variant="ghost" size="icon" aria-label={`Remove row ${ri + 1}`} onClick={() => delRow(ri)} disabled={rows.length === 1}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="soft" size="sm" onClick={addRow}><Plus className="h-4 w-4" /> Add row</Button>
          {columns.length < 8 && <Button type="button" variant="soft" size="sm" onClick={addCol}><Plus className="h-4 w-4" /> Add column</Button>}
        </div>
      </div>

      <Field label="Tips (one per line)" hint="Shown below the table, e.g. how to measure."><Textarea className="min-h-24" value={tips} onChange={(e) => setTips(e.target.value)} /></Field>

      <div className="flex items-center justify-between rounded-sm border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Show on the website</p>
        <Switch checked={active} onChange={setActive} label="Show size guide on website" />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-line pt-5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : item ? "Save changes" : "Add size guide"}</Button>
      </div>
    </form>
  );
}

export function SizeGuideAdmin({ initial }: { initial: SizeGuideItem[] }) {
  const [items, setItems] = React.useState<SizeGuideItem[]>(initial);
  const [editing, setEditing] = React.useState<SizeGuideItem | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<SizeGuideItem | null>(null);

  const save = async (d: Draft): Promise<boolean> => {
    try {
      if (editing === "new") {
        const { id, slug } = await postJson<{ id: string; slug: string }>("/api/admin/size-guides", d);
        setItems((cur) => [...cur, { ...d, id, slug, order: cur.length }]);
      } else if (editing) {
        const id = editing.id;
        await postJson(`/api/admin/size-guides/${id}`, d, "PUT");
        setItems((cur) => cur.map((x) => (x.id === id ? { ...x, ...d } : x)));
      }
      toast.success(editing === "new" ? "Size guide added" : "Changes saved", { description: "Updated on the website." });
      setEditing(null);
      return true;
    } catch (e) {
      toast.error("Could not save size guide", { description: e instanceof Error ? e.message : "Please check the table and try again." });
      return false;
    }
  };

  const toggle = async (g: SizeGuideItem, v: boolean) => {
    setItems((cur) => cur.map((x) => (x.id === g.id ? { ...x, active: v } : x)));
    try {
      await postJson(`/api/admin/size-guides/${g.id}`, { active: v }, "PUT");
      toast.success(v ? "Size guide shown on website" : "Size guide hidden from website");
    } catch (e) {
      setItems((cur) => cur.map((x) => (x.id === g.id ? { ...x, active: !v } : x)));
      toast.error("Could not update", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const prev = items;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    try {
      await postJson("/api/admin/size-guides/reorder", { ids: next.map((x) => x.id) });
    } catch (e) {
      setItems(prev);
      toast.error("Could not change the order", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await postJson(`/api/admin/size-guides/${deleting.id}`, {}, "DELETE");
      setItems((c) => c.filter((x) => x.id !== deleting.id));
      toast.success("Size guide deleted");
      setDeleting(null);
    } catch (e) {
      toast.error("Could not delete", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Size guides"
        description="Make a chart for each kind of clothing, for example Women (by size) and Kids (by age). In each product, tick which charts apply: Women, Kids, or both for twinning sets."
        action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add size guide</Button>}
      />
      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-sm border border-dashed border-line bg-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-primary-faint text-primary"><Ruler className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg">No size guides yet</h2>
          <Button className="mt-5" onClick={() => setEditing("new")}>Add size guide</Button>
        </div>
      ) : (
        <ul className="grid gap-4">
          {items.map((g, idx) => (
            <li key={g.id} className={cn("rounded-sm border border-line bg-card p-4 shadow-card", !g.active && "opacity-75")}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{g.name}</p>
                  <p className="text-sm">{g.rows.length} row{g.rows.length === 1 ? "" : "s"} · {g.columns.join(", ")} · {g.unit}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                  <label className="flex items-center gap-2 text-sm font-medium text-ink">
                    <Switch checked={g.active} onChange={(v) => toggle(g, v)} label={`${g.active ? "Hide" : "Show"} ${g.name}`} />
                    {g.active ? "Active" : "Inactive"}
                  </label>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Move ${g.name} up`} disabled={idx === 0} onClick={() => move(idx, -1)}><ChevronUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Move ${g.name} down`} disabled={idx === items.length - 1} onClick={() => move(idx, 1)}><ChevronDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Edit ${g.name}`} onClick={() => setEditing(g)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="dangerSoft" size="icon" aria-label={`Delete ${g.name}`} onClick={() => setDeleting(g)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add size guide" : "Edit size guide"} wide>
        {editing !== null && <GuideForm key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} onSave={save} onCancel={() => setEditing(null)} />}
      </Dialog>
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this size guide?"
        footer={<><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete size guide</Button></>}
      >
        <p className="text-sm">“{deleting?.name}” will be removed and un-ticked from every product that used it. This cannot be undone.</p>
      </Dialog>
    </>
  );
}