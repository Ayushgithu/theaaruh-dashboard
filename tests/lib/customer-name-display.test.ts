// @vitest-environment node
import { describe, expect, it } from "vitest";
import { toOrder } from "@/lib/repo-shop";
import { toReturn } from "@/lib/repo-returns";

describe("customer name display", () => {
  it("uppercases customer names in orders", () => {
    const order = toOrder({
      _id: "order-id",
      user: "user-id",
      customer: { name: "Ravi Kumar", email: "ravi@example.com", phone: "9876543210" },
    });

    expect(order.customer.name).toBe("RAVI KUMAR");
  });

  it("uppercases customer names in return requests", () => {
    const request = toReturn({
      _id: "return-id",
      order: "order-id",
      user: "user-id",
      customer: { name: "Ravi Kumar", email: "ravi@example.com", phone: "9876543210" },
    });

    expect(request.customer.name).toBe("RAVI KUMAR");
  });
});
