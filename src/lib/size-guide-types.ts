export interface SizeGuideItem {
  id: string;
  name: string;
  slug: string;
  unit: string;
  columns: string[];
  rows: string[][];
  tips: string[];
  active: boolean;
  order: number;
}