export interface CollectionItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  image?: string;
  products: string[]; // product ids, in the order picked
  active: boolean;
  order: number;
}

/** The small product card used by the "pick products" grid. */
export interface PickProduct { id: string; name: string; image?: string; price: number; category: string }