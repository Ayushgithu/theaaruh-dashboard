export type CouponType = "percent" | "flat" | "shipping";
export type CouponScope = "all" | "products" | "collections";
export type PayWith = "any" | "online" | "cod";
export type CouponAudience = "everyone" | "selected";

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
  excludeSale: boolean;
  payWith: PayWith;
  audience: CouponAudience;
  customers: string[];
  active: boolean;
  visible: boolean;
  /** orders that used it (not counting cancelled) and the discount given */
  used: number;
  saved: number;
  createdAt: string;
};

/** The simple list used by the "pick collections" boxes. */
export type PickCollection = { id: string; name: string };

/** A customer in the "only these customers" picker. */
export type PickCustomer = { id: string; name: string; email: string; phone: string };