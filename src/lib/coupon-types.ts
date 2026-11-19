export type CouponType = "percent" | "flat" | "shipping";
export type CouponScope = "all" | "products" | "collections";

export type AdminCoupon = {
  id: string;
  code: string;
  title: string;
  description: string;
  type: CouponType;
  value: number;
  maxDiscount: number;
  minOrder: number;
  startsAt?: string;
  endsAt?: string;
  usageLimit: number;
  perCustomer: number;
  firstOrderOnly: boolean;
  scope: CouponScope;
  products: string[];
  collections: string[];
  active: boolean;
  visible: boolean;
  /** orders that used it (not counting cancelled) and the discount given */
  used: number;
  saved: number;
  createdAt: string;
};

/** The simple list used by the "pick collections" boxes. */
export type PickCollection = { id: string; name: string };