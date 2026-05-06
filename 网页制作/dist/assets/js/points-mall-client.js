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
    body: payload
  });
}

export function getPointsRedemptions() {
  return apiFetch("/api/points-mall/redemptions");
}

export function adminGetPointsMallItems(key) {
  return apiFetch("/api/admin/points-mall/items", {
    headers: {
      "x-admin-key": key
    }
  });
}

export function adminGetPointsRedemptions(key) {
  return apiFetch("/api/admin/points-mall/redemptions", {
    headers: {
      "x-admin-key": key
    }
  });
}

