import { apiFetch } from "./api-client.js";

export function adminLogin(payload) {
  return apiFetch("/api/admin/auth/login", {
    method: "POST",
    body: payload
  });
}

export function adminLogout() {
  return apiFetch("/api/admin/auth/logout", {
    method: "POST"
  });
}

export function getCurrentAdmin() {
  return apiFetch("/api/admin/auth/me");
}

export function adminGetMembers() {
  return apiFetch("/api/admin/members");
}

export function adminGetOrders() {
  return apiFetch("/api/admin/orders");
}

export function adminGetPoints() {
  return apiFetch("/api/admin/points");
}

export function adminGetAuditLogs() {
  return apiFetch("/api/admin/audit-logs");
}

export function adminGetPointsMallItems() {
  return apiFetch("/api/admin/points-mall/items");
}

export function adminGetProducts() {
  return apiFetch("/api/admin/products");
}

export function adminCreateProduct(payload) {
  return apiFetch("/api/admin/products", {
    method: "POST",
    body: payload
  });
}

export function adminUpdateProduct(productId, payload) {
  return apiFetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    body: payload
  });
}

export function adminSetProductStatus(productId, action) {
  return apiFetch(`/api/admin/products/${encodeURIComponent(productId)}/${action}`, {
    method: "POST",
    body: {
      reason: action === "activate" ? "后台上架商品" : action === "deactivate" ? "后台下架商品" : "后台归档商品"
    }
  });
}

export function adminAdjustProductInventory(productId, variantId, payload) {
  return apiFetch(`/api/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/inventory`, {
    method: "POST",
    body: payload
  });
}

export function adminGetPointsRedemptions() {
  return apiFetch("/api/admin/points-mall/redemptions");
}

export function adminPayOrder(orderId) {
  return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/pay`, {
    method: "POST"
  });
}

export function adminCompleteOrder(orderId) {
  return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/complete`, {
    method: "POST"
  });
}

export function adminRefundOrder(orderId) {
  return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`, {
    method: "POST"
  });
}

export function adminSetMallItemStatus(itemId, action) {
  return apiFetch(`/api/admin/points-mall/items/${encodeURIComponent(itemId)}/${action}`, {
    method: "POST"
  });
}

export function adminCreateMallItem(payload) {
  return apiFetch("/api/admin/points-mall/items", {
    method: "POST",
    body: payload
  });
}

export function adminUpdateRedemptionStatus(redemptionId, payload) {
  return apiFetch(`/api/admin/points-mall/redemptions/${encodeURIComponent(redemptionId)}/status`, {
    method: "PATCH",
    body: payload
  });
}

export function adminCancelRedemption(redemptionId) {
  return apiFetch(`/api/admin/points-mall/redemptions/${encodeURIComponent(redemptionId)}/cancel`, {
    method: "POST",
    body: {
      reason: "后台取消兑换"
    }
  });
}
