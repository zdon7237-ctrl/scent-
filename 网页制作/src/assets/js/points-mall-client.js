import { apiFetch } from "./api-client.js";

export function getPointsMallItems() {
  return apiFetch("/api/points-mall/items");
}

export function getPointsMallItem(id) {
  return apiFetch(`/api/points-mall/items/${encodeURIComponent(id)}`);
}

export function redeemPointsMallItem(payload) {
  return apiFetch("/api/points-mall/redeem", {
    method: "POST",
    headers: { "idempotency-key": payload.idempotencyKey || payload.requestId },
    body: payload
  });
}

export function getPointsRedemptions() {
  return apiFetch("/api/points-mall/redemptions");
}
