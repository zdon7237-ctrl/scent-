import { apiFetch } from "./api-client.js";

export function getMemberProfile() {
  return apiFetch("/api/member/profile");
}

export function updateMemberProfile(payload) {
  return apiFetch("/api/member/profile", {
    method: "PATCH",
    body: payload
  });
}

export function getPointTransactions() {
  return apiFetch("/api/member/points");
}

export function getMemberOrders() {
  return apiFetch("/api/member/orders");
}

export function getTierProgress() {
  return apiFetch("/api/member/tier-progress");
}

export function confirmReceiptOrder(orderId, idempotencyKey) {
  return apiFetch(`/api/member/orders/${encodeURIComponent(orderId)}/confirm-receipt`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: { idempotencyKey }
  });
}

export function getAddresses() {
  return apiFetch("/api/member/addresses");
}

export function createAddress(payload) {
  return apiFetch("/api/member/addresses", { method: "POST", body: payload });
}

export function updateAddress(addressId, payload) {
  return apiFetch(`/api/member/addresses/${encodeURIComponent(addressId)}`, { method: "PATCH", body: payload });
}

export function deleteAddress(addressId) {
  return apiFetch(`/api/member/addresses/${encodeURIComponent(addressId)}`, { method: "DELETE" });
}

export function quoteOrder(items) {
  return apiFetch("/api/checkout/quote", { method: "POST", body: { items } });
}

export function createOrder(payload, requestId) {
  return apiFetch("/api/checkout/create-order", {
    method: "POST",
    headers: { "idempotency-key": requestId },
    body: { ...payload, requestId }
  });
}

export function startPayment(orderId, options = {}) {
  return apiFetch("/api/checkout/start-payment", {
    method: "POST",
    headers: { "idempotency-key": options.idempotencyKey },
    body: { orderId, ...options }
  });
}

export function cancelOrder(orderId, reason = "member_cancelled", idempotencyKey) {
  return apiFetch(`/api/member/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: { reason, idempotencyKey }
  });
}
