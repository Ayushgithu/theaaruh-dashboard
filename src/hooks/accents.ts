export const ACCENT_KEY = "lc_accent";
export const DEFAULT_ACCENT = "green";

/** Swatches shown in Settings > Appearance. The actual colour tokens live in globals.css ([data-accent="…"]). */
export const ACCENTS = [
  {
    "id": "green",
    "name": "Green",
    "color": "#15803d",
    "dark": "#000000"
  },
  {
    "id": "blue",
    "name": "Blue",
    "color": "#2563eb",
    "dark": "#000000"
  },
  {
    "id": "orange",
    "name": "Orange",
    "color": "#c2410c",
    "dark": "#000000"
  },
  {
    "id": "purple",
    "name": "Purple",
    "color": "#7e22ce",
    "dark": "#000000"
  },
  {
    "id": "maroon",
    "name": "Maroon",
    "color": "#8c1d40",
    "dark": "#000000"
  },
  {
    "id": "teal",
    "name": "Teal",
    "color": "#0f766e",
    "dark": "#000000"
  },
  {
    "id": "pink",
    "name": "Pink",
    "color": "#be185d",
    "dark": "#000000"
  },
  {
    "id": "gold",
    "name": "Gold",
    "color": "#a16207",
    "dark": "#000000"
  }
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];

export const accentById = (id: string | null | undefined) => ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];

/** Colour of the browser UI (mobile address bar) for the current accent + theme. */
export function metaColor(dark: boolean, id?: string | null) {
  const a = accentById(id ?? document.documentElement.dataset.accent);
  return dark ? a.dark : a.color;
}

/** Sets the accent on <html> and remembers it in this browser. */
export function applyAccent(id: string, persist = true) {
  const root = document.documentElement;
  const a = accentById(id);
  if (a.id === DEFAULT_ACCENT) root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", a.id);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", metaColor(root.classList.contains("dark"), a.id));
  if (persist) {
    try { localStorage.setItem(ACCENT_KEY, a.id); } catch {}
  }
}
