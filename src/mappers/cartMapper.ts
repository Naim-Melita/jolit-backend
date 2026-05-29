import { toMoney } from "../lib/money.js";
import { toProductResponse } from "./productMapper.js";

type CartWithItems = {
  id: number;
  items: Array<{
    id: number;
    quantity: number;
    product: Parameters<typeof toProductResponse>[0];
  }>;
};

export function toCartResponse(cart: CartWithItems) {
  const items = cart.items.map((item) => {
    const product = toProductResponse(item.product);
    const subtotal = Number(product.price) * item.quantity;

    return {
      id: item.id,
      productId: product.id,
      product,
      quantity: item.quantity,
      subtotal: toMoney(subtotal),
    };
  });
  const totalAmount = items.reduce(
    (total, item) => total + Number(item.subtotal),
    0
  );

  return {
    id: cart.id,
    items,
    totalAmount: toMoney(totalAmount),
  };
}
