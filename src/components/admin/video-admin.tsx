"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, Film, ImageOff, Link2, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { VideoItem, VideoPickProduct, VideoSection } from "@/lib/video-types";
import { cloudinaryPoster, parseVideoLink, ytThumb, VIDEO_MAX_BYTES } from "@/lib/video-shared";
import { postJson, uploadImages } from "@/lib/api";
import { cloudinaryReady, uploadVideoToCloudinary } from "@/lib/video-upload";
import { cn, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/form";
import { Dialog } from "@/components/ui/drawer";
import { PhotoUpload } from "@/components/shared/photo-upload";
import { AdminPageHeader } from "./shell";

const KIND_LABEL = { cloudinary: "Uploaded", link: "Video link", youtube: "YouTube", instagram: "Instagram" } as const;
const linkOf = (v: VideoItem) => (v.kind === "youtube" ? `https://www.youtube.com/shorts/${v.src}` : v.kind === "instagram" ? `https://www.instagram.com/reel/${v.src}/` : v.src);
const coverOf = (v: Pick<VideoItem, "kind" | "src" | "poster">) => v.poster || (v.kind === "youtube" ? ytThumb(v.src) : v.kind === "cloudinary" ? cloudinaryPoster(v.src) : undefined);

function Thumb({ v, className }: { v: Pick<VideoItem, "kind" | "src" | "poster">; className?: string }) {
  const cover = coverOf(v);
  if (!cover && v.kind === "link") return <video src={`${v.src}#t=0.1`} muted playsInline preload="metadata" className={className} />;
  // eslint-disable-next-line @next/next/no-img-element
  return cover ? <img src={cover} alt="" className={className} /> : <Film className="h-6 w-6" />;
}

type Draft = { title: string; source: string; poster?: string; products: string[]; active: boolean };

function VideoForm({ item, products, onSave, onCancel }: { item: VideoItem | null; products: VideoPickProduct[]; onSave: (d: Draft) => Promise<boolean>; onCancel: () => void }) {
  const [mode, setMode] = React.useState<"upload" | "link">(item && item.kind !== "cloudinary" ? "link" : "upload");
  const [title, setTitle] = React.useState(item?.title ?? "");
  const [link, setLink] = React.useState(item ? linkOf(item) : "");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string>("");
  const [poster, setPoster] = React.useState<string | undefined>(item?.poster);
  const [posterFiles, setPosterFiles] = React.useState<File[]>([]);
  const known = React.useMemo(() => new Set(products.map((p) => p.id)), [products]);
  const [picked, setPicked] = React.useState<string[]>((item?.products ?? []).filter((id) => known.has(id)));
  const [active, setActive] = React.useState(item?.active ?? true);
  const [q, setQ] = React.useState("");
  const [error, setError] = React.useState("");
  const [progress, setProgress] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const previewUrlRef = React.useRef("");

  React.useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const selectFile = (next: File | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = next ? URL.createObjectURL(next) : "";
    setFile(next);
    setPreview(previewUrlRef.current);
  };

  const detected = React.useMemo(() => (link.trim() ? parseVideoLink(link) : null), [link]);
  const shown = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? products.filter((p) => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s)) : products;
  }, [products, q]);
  const toggle = (id: string) => setPicked((cur) => {
    if (cur.includes(id)) return cur.filter((x) => x !== id);
    if (cur.length >= 4) { toast("You can tag up to 4 products on one video"); return cur; }
    return [...cur, id];
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    let source = "";
    if (mode === "upload") {
      if (file) {
        if (file.size > VIDEO_MAX_BYTES) return setError(`This video is ${(file.size / 1024 / 1024).toFixed(0)} MB. Please keep it under ${VIDEO_MAX_BYTES / 1024 / 1024} MB.`);
      } else if (item?.kind === "cloudinary") source = item.src;
      else return setError("Choose a video file to upload.");
    } else {
      if (!detected) return setError("Paste a YouTube / Shorts link, an Instagram reel link, or a direct https .mp4 link.");
      source = link.trim();
    }
    const needsCover = mode === "link" && detected?.kind === "instagram";
    if (needsCover && !poster && !posterFiles[0]) return setError("Instagram reels need a cover photo. Add one below.");
    setBusy(true);
    try {
      if (mode === "upload" && file) source = await uploadVideoToCloudinary(file, setProgress);
      let cover = poster;
      if (posterFiles[0]) cover = (await uploadImages([posterFiles[0]]))[0];
      await onSave({ title: title.trim(), source, poster: cover, products: picked, active });
    } catch (err) {
      toast.error("Could not upload", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const tab = (on: boolean) => cn("flex flex-1 items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm font-semibold transition", on ? "bg-primary text-white" : "text-ink hover:bg-surface");

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="Title (optional)" hint="Shown on the video card, e.g. Festive Anarkali look."><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="e.g. Twinning with my daughter" /></Field>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">Video</p>
        <div className="mb-3 flex gap-1 rounded-sm border border-line bg-card p-1">
          <button type="button" className={tab(mode === "upload")} onClick={() => setMode("upload")}><Upload className="h-4 w-4" /> Upload video</button>
          <button type="button" className={tab(mode === "link")} onClick={() => setMode("link")}><Link2 className="h-4 w-4" /> Paste link</button>
        </div>

        {mode === "upload" ? (
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex aspect-[9/16] w-28 items-center justify-center overflow-hidden rounded-sm border border-line bg-surface">
              {preview ? <video src={preview} muted playsInline controls className="h-full w-full object-cover" /> : item?.kind === "cloudinary" ? <Thumb v={item} className="h-full w-full object-cover" /> : <Film className="h-7 w-7" />}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(e) => { selectFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy || !cloudinaryReady}><Upload className="h-4 w-4" /> {file || item?.kind === "cloudinary" ? "Choose a different video" : "Choose video"}</Button>
              {file && <p className="text-sm text-ink">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
              {!file && item?.kind === "cloudinary" && <p className="text-xs">Current video is kept unless you choose a new one.</p>}
              {!cloudinaryReady && <p role="alert" className="rounded-sm border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">Video upload is not set up yet. Add <strong>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</strong> and <strong>NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</strong> in Vercel (dashboard project) and redeploy. Until then you can still use the “Paste link” tab.</p>}
              <p className="text-xs">MP4, WebM or MOV, up to {VIDEO_MAX_BYTES / 1024 / 1024} MB. Best: a vertical (9:16) clip of 15–30 seconds. Videos are stored on Cloudinary and shown in a light 720p version on the website.</p>
            </div>
          </div>
        ) : (
          <div>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.youtube.com/shorts/…  or  https://www.instagram.com/reel/…" inputMode="url" />
            <p className={cn("mt-2 text-xs", link.trim() && !detected && "font-semibold text-red-600")}>
              {!link.trim() ? "Works with YouTube / Shorts, Instagram reels, a Cloudinary video link, or a direct https link ending in .mp4 / .webm." : detected ? `Detected: ${detected.kind === "cloudinary" ? "Cloudinary video" : KIND_LABEL[detected.kind]}.` : "This link is not supported yet."}
            </p>
          </div>
        )}
        {progress !== null && (
          <div className="mt-3" role="status" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
            <p className="mt-1 text-xs">Uploading video… {progress}%. Please keep this window open.</p>
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">Cover photo {mode === "link" && detected?.kind === "instagram" ? <span className="text-red-600">(required for Instagram)</span> : "(optional)"}</p>
        {poster && !posterFiles.length && (
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster} alt="" className="h-24 w-16 rounded-sm border border-line object-cover" />
            <Button type="button" variant="outline" size="sm" onClick={() => setPoster(undefined)}>Remove cover</Button>
          </div>
        )}
        <PhotoUpload files={posterFiles} onChange={(f) => setPosterFiles(f.slice(-1))} max={1} />
        <p className="mt-2 text-xs">Shown before the video plays. If you add none, the video&apos;s first frame (or the YouTube thumbnail) is used automatically.</p>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-ink">Products shown with this video</p>
            <p className="text-xs"><strong className="text-ink">{picked.length}</strong> of 4 selected. The first one is shown first.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setPicked([])} disabled={picked.length === 0}>Clear</Button>
        </div>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input aria-label="Search products" className="pl-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {products.length === 0 ? <p className="rounded-sm border border-dashed border-line p-6 text-center text-sm">Add clothing products first, then tag them here.</p> : (
          <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto rounded-sm border border-line p-2 sm:grid-cols-4">
            {shown.length === 0 && <p className="col-span-full p-6 text-center text-sm">No products match “{q}”.</p>}
            {shown.map((p) => {
              const idx = picked.indexOf(p.id);
              const on = idx >= 0;
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => toggle(p.id)} className={cn("relative overflow-hidden rounded-sm border-2 bg-card text-left transition", on ? "border-primary" : "border-line hover:border-primary/50")}>
                  <div className="flex aspect-[3/4] items-center justify-center bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ImageOff className="h-5 w-5" />}
                  </div>
                  <div className="p-2"><p className="line-clamp-1 text-xs font-semibold text-ink">{p.name}</p><p className="text-xs">{formatPrice(p.price)}</p></div>
                  {on && <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{idx + 1}</span>}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-xs">Customers see these under the video with a “View product” button. Tick them in the order you want them shown.</p>
      </div>

      <div className="flex items-center justify-between rounded-sm border border-line bg-surface p-4">
        <div><p className="text-sm font-semibold text-ink">Show on the website</p><p className="text-xs">Switch off to hide this video without deleting it.</p></div>
        <Switch checked={active} onChange={setActive} label="Show video on website" />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-line pt-5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? (progress !== null ? `Uploading ${progress}%` : "Saving…") : item ? "Save changes" : "Add video"}</Button>
      </div>
    </form>
  );
}

function SectionCard({ section, onSaved }: { section: VideoSection; onSaved: (s: VideoSection) => void }) {
  const [enabled, setEnabled] = React.useState(section.enabled);
  const [title, setTitle] = React.useState(section.title);
  const [subtitle, setSubtitle] = React.useState(section.subtitle);
  const [busy, setBusy] = React.useState(false);
  const dirty = title.trim() !== section.title || subtitle.trim() !== section.subtitle;

  const save = async (next: VideoSection) => {
    setBusy(true);
    try {
      await postJson("/api/admin/videos/section", next, "PUT");
      onSaved(next);
      toast.success("Saved", { description: "Updated on the website." });
      return true;
    } catch (e) {
      toast.error("Could not save", { description: e instanceof Error ? e.message : "Please try again." });
      return false;
    } finally { setBusy(false); }
  };
  const flip = async (v: boolean) => {
    setEnabled(v);
    if (!(await save({ enabled: v, title: section.title, subtitle: section.subtitle }))) setEnabled(!v);
  };

  return (
    <div className="mb-6 rounded-sm border border-line bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-ink">Show “{section.title}” on the home page</p>
          <p className="text-sm">Switch off to hide the whole video section. Your videos are kept, so you can bring it back any time (for example after a festival).</p>
        </div>
        <Switch checked={enabled} onChange={flip} label="Show the video section on the home page" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <Field label="Heading"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} /></Field>
        <Field label="Line under the heading"><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={120} /></Field>
        <Button disabled={!dirty || busy} onClick={() => save({ enabled, title: title.trim() || section.title, subtitle: subtitle.trim() })}>Save</Button>
      </div>
    </div>
  );
}

export function VideoAdmin({ initial, section: initialSection, products }: { initial: VideoItem[]; section: VideoSection; products: VideoPickProduct[] }) {
  const [items, setItems] = React.useState<VideoItem[]>(initial);
  const [section, setSection] = React.useState<VideoSection>(initialSection);
  const [editing, setEditing] = React.useState<VideoItem | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<VideoItem | null>(null);
  const byId = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const save = async (d: Draft): Promise<boolean> => {
    try {
      if (editing === "new") {
        const { id, kind, src } = await postJson<{ id: string; kind: VideoItem["kind"]; src: string }>("/api/admin/videos", d);
        setItems((cur) => [...cur, { id, title: d.title, kind, src, poster: d.poster, products: d.products, active: d.active, order: cur.length }]);
      } else if (editing) {
        const id = editing.id;
        const r = await postJson<{ kind: VideoItem["kind"]; src: string }>(`/api/admin/videos/${id}`, d, "PUT");
        setItems((cur) => cur.map((x) => (x.id === id ? { ...x, title: d.title, kind: r.kind, src: r.src, poster: d.poster, products: d.products, active: d.active } : x)));
      }
      toast.success(editing === "new" ? "Video added" : "Changes saved", { description: "Updated on the website." });
      setEditing(null);
      return true;
    } catch (e) {
      toast.error("Could not save video", { description: e instanceof Error ? e.message : "Please try again." });
      return false;
    }
  };

  const toggle = async (v: VideoItem, on: boolean) => {
    setItems((cur) => cur.map((x) => (x.id === v.id ? { ...x, active: on } : x)));
    try {
      await postJson(`/api/admin/videos/${v.id}`, { active: on }, "PUT");
      toast.success(on ? "Video shown on website" : "Video hidden from website");
    } catch (e) {
      setItems((cur) => cur.map((x) => (x.id === v.id ? { ...x, active: !on } : x)));
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
      await postJson("/api/admin/videos/reorder", { ids: next.map((x) => x.id) });
    } catch (e) {
      setItems(prev);
      toast.error("Could not change the order", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await postJson(`/api/admin/videos/${deleting.id}`, {}, "DELETE");
      setItems((c) => c.filter((x) => x.id !== deleting.id));
      toast.success("Video deleted");
      setDeleting(null);
    } catch (e) {
      toast.error("Could not delete", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Videos"
        description="Short vertical videos for the home page. Customers tap a video to watch it full screen and shop the products you tag under it."
        action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add video</Button>}
      />
      <SectionCard section={section} onSaved={setSection} />

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-sm border border-dashed border-line bg-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-primary-faint text-primary"><Film className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg">No videos yet</h2>
          <p className="mt-1 max-w-sm text-sm">Add your first video. Until you do, the video section is not shown on the website.</p>
          <Button className="mt-5" onClick={() => setEditing("new")}>Add video</Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {items.map((v, idx) => {
            const names = v.products.map((id) => byId.get(id)?.name).filter(Boolean) as string[];
            return (
              <li key={v.id} className="overflow-hidden rounded-sm border border-line bg-card shadow-card">
                <div className="relative flex aspect-[9/16] items-center justify-center bg-surface">
                  <Thumb v={v} className={cn("h-full w-full object-cover", !v.active && "opacity-40")} />
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">{KIND_LABEL[v.kind]}</span>
                  {!v.active && <span className="absolute inset-x-2 bottom-2 rounded-sm bg-white/90 px-2 py-1 text-center text-xs font-semibold text-ink">Hidden from website</span>}
                </div>
                <div className="space-y-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{v.title || "Untitled video"}</p>
                    <p className="truncate text-xs">{names.length ? names.join(", ") : "No product tagged"}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Switch checked={v.active} onChange={(on) => toggle(v, on)} label={`${v.active ? "Hide" : "Show"} ${v.title || "video"}`} />
                    <div className="flex">
                      <Button variant="ghost" size="icon" aria-label="Move earlier" disabled={idx === 0} onClick={() => move(idx, -1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Move later" disabled={idx === items.length - 1} onClick={() => move(idx, 1)}><ChevronRight className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Edit video" onClick={() => setEditing(v)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="dangerSoft" size="icon" aria-label="Delete video" onClick={() => setDeleting(v)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add video" : "Edit video"} wide>
        {editing !== null && <VideoForm key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} products={products} onSave={save} onCancel={() => setEditing(null)} />}
      </Dialog>
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this video?"
        footer={<><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete video</Button></>}
      >
        <p className="text-sm">“{deleting?.title || "This video"}” will be removed from the website. Your products are not deleted. This cannot be undone.</p>
      </Dialog>
    </>
  );
}