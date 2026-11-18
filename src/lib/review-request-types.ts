export type ReviewRequestSettings = { autoEmail: boolean; afterDays: number };

export type ReviewRequestRow = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  deliveredAt: string;
  /** when the "please review" message becomes due (delivered + afterDays) */
  dueAt: string;
  items: { productId: string; name: string; slug: string; image?: string }[];
  /** ready-to-send WhatsApp message */
  whatsapp: string;
  requested?: { at: string; via: "email" | "whatsapp" | "auto" };
};