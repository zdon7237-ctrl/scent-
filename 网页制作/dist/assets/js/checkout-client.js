import { apiFetch } from "./api-client.js";

function normalizeCartItems(cartItems) {
  return cartItems.map((entry) => ({
    productId: entry.item.id,
    quantity: entry.qty
  }));
}

export function quoteCheckout(cartItems) {
  return apiFetch("/api/checkout/quote", {
    method: "POST",
    body: {
      items: normalizeCartItems(cartItems)
    }
  });
}

export function createOrder(cartItems) {
  return apiFetch("/api/checkout/create-order", {
    method: "POST",
    body: {
      items: normalizeCartItems(cartItems)
    }
  });
}

export function startPayment(orderId) {
  return apiFetch("/api/checkout/start-payment", {
    method: "POST",
    body: {
      orderId
    }
  });
}
