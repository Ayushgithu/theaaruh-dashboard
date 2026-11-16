import type { VideoKind } from "./video-shared";

export interface VideoItem {
  id: string;
  title: string;
  kind: VideoKind;
  src: string;
  poster?: string;
  products: string[]; // product ids, in the order picked
  active: boolean;
  order: number;
}

/** The "Shop by video" block on the home page. */
export interface VideoSection { enabled: boolean; title: string; subtitle: string }
export const DEFAULT_VIDEO_SECTION: VideoSection = { enabled: true, title: "Shop by video", subtitle: "Watch it styled, then shop the look." };

export interface VideoPickProduct { id: string; name: string; image?: string; price: number; category: string }