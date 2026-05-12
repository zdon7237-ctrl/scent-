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

export function confirmReceiptOrder(orderId) {
  return apiFetch(`/api/member/orders/${encodeURIComponent(orderId)}/confirm-receipt`, {
    method: "POST"
  });
}
