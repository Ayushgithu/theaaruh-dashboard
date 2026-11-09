"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, ExternalLink, LogOut, Moon, Search, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENTS, applyAccent } from "@/hooks/accents";
import { applyTheme } from "@/hooks/use-theme";

type Icon = React.ComponentType<{ className?: string }>;
export type PaletteSection = { title: string; items: { label: string; href: string; Icon: Icon }[] };
interface Command { id: string; label: string; group: string; Icon?: Icon; swatch?: string; run: () => void }

/** Ctrl/⌘ + K quick search: jump to any admin page, switch theme colour or mode, open the website, sign out. */
export function CommandPalette({
  open, onOpenChange, sections, websiteUrl, onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: PaletteSection[];
  websiteUrl: string;
  onLogout: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Global shortcut
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onOpenChange(!open); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Reset on open, return focus on close
  React.useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    // Reset command state when the controlled palette opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(""); setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => before?.focus?.();
  }, [open]);

  const commands = React.useMemo<Command[]>(() => {
    if (!open) return [];
    const dark = document.documentElement.classList.contains("dark");
    const nav = sections.flatMap((s) => s.items.map((i) => ({ id: i.href, label: i.label, group: s.title, Icon: i.Icon, run: () => router.push(i.href) })));
    const actions: Command[] = [
      { id: "mode", label: dark ? "Switch to light mode" : "Switch to dark mode", group: "Actions", Icon: dark ? Sun : Moon, run: () => applyTheme(dark ? "light" : "dark") },
      { id: "site", label: "View website", group: "Actions", Icon: ExternalLink, run: () => window.open(websiteUrl, "_blank", "noopener,noreferrer") },
      { id: "logout", label: "Sign out", group: "Actions", Icon: LogOut, run: onLogout },
    ];
    const colours: Command[] = ACCENTS.map((a) => ({ id: `accent-${a.id}`, label: `Theme colour: ${a.name}`, group: "Theme colour", swatch: a.color, run: () => applyAccent(a.id) }));
    return [...nav, ...actions, ...colours];
  }, [open, sections, router, websiteUrl, onLogout]);

  const q = query.trim().toLowerCase();
  const results = q ? commands.filter((c) => `${c.label} ${c.group}`.toLowerCase().includes(q)) : commands;
  const current = Math.min(active, Math.max(0, results.length - 1));

  React.useEffect(() => {
    document.getElementById(`cmd-${current}`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  if (!open) return null;

  const run = (c?: Command) => { if (!c) return; onOpenChange(false); c.run(); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((current + 1) % Math.max(1, results.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((current - 1 + results.length) % Math.max(1, results.length)); }
    else if (e.key === "Enter") { e.preventDefault(); run(results[current]); }
    else if (e.key === "Escape") { e.preventDefault(); onOpenChange(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search and commands">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} aria-hidden />
      <div className="relative w-full max-w-lg overflow-hidden rounded-sm border border-line bg-card shadow-lift">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-5 w-5 shrink-0 text-ink/40" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded
            aria-controls="cmd-list"
            aria-activedescendant={results.length ? `cmd-${current}` : undefined}
            placeholder="Search pages and actions…"
            className="h-12 w-full bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-ink/40"
          />
          <kbd className="hidden rounded-sm border border-line px-1.5 py-0.5 text-[11px] text-ink/50 sm:block">Esc</kbd>
        </div>

        <ul id="cmd-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm">No results for “{query}”.</li>}
          {results.map((c, i) => (
            <React.Fragment key={c.id}>
              {(i === 0 || results[i - 1].group !== c.group) && (
                <li role="presentation" className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.4px] text-ink/40 first:pt-1">{c.group}</li>
              )}
              <li
                id={`cmd-${i}`}
                role="option"
                aria-selected={i === current}
                onMouseMove={() => setActive(i)}
                onClick={() => run(c)}
                className={cn("flex min-h-10 cursor-pointer items-center gap-3 rounded-sm px-3 text-[0.9375rem]", i === current ? "bg-primary-faint text-ink" : "text-ink/75")}
              >
                {c.swatch ? <span className="h-5 w-5 shrink-0 rounded-full" style={{ backgroundColor: c.swatch }} aria-hidden /> : c.Icon && <c.Icon className="h-5 w-5 shrink-0 text-primary" />}
                <span className="truncate">{c.label}</span>
                {i === current && <CornerDownLeft className="ml-auto h-4 w-4 shrink-0 text-ink/40" aria-hidden />}
              </li>
            </React.Fragment>
          ))}
        </ul>

        <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-xs text-ink/50 sm:flex">
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
