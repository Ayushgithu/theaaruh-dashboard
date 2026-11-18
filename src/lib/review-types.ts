export type ReviewStatus = "pending" | "approved" | "rejected";

export type AdminReview = {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  title: string;
  text: string;
  fit: "" | "small" | "right" | "large";
  sizeBought: string;
  photos: string[];
  avatar: string;
  verified: boolean;
  status: ReviewStatus;
  featured: boolean;
  reply?: string;
  createdAt: string;
};