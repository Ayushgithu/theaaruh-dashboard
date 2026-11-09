"use client";
import * as React from "react";
import { DEFAULT_ACCENT, applyAccent, accentById, type AccentId } from "./accents";

const getAccent = () => accentById(document.documentElement.dataset.accent).id;
const subscribeToAccent = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-accent"] });
  return () => observer.disconnect();
};

export function useAccent() {
  const accent = React.useSyncExternalStore<AccentId>(subscribeToAccent, getAccent, () => DEFAULT_ACCENT);
  const setAccent = React.useCallback((id: AccentId) => applyAccent(id), []);
  return { accent, setAccent };
}
