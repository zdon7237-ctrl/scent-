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

export function adminChangePassword(payload) {
  return apiFetch("/api/admin/auth/change-password", {
    method: "POST",
    body: payload
  });
}

export function adminRevokeOtherSessions() {
  return apiFetch("/api/admin/auth/sessions/revoke-others", {
    method: "POST"
  });
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
    headers: { "idempotency-key": payload.idempotencyKey },
    body: payload
  });
}

export function adminUpdateProduct(productId, payload) {
  return apiFetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    headers: { "idempotency-key": payload.idempotencyKey },
    body: payload
  });
}

export function adminSetProductStatus(productId, action, idempotencyKey) {
  return apiFetch(`/api/admin/products/${encodeURIComponent(productId)}/${action}`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: {
      idempotencyKey,
      reason: action === "activate" ? "后台上架商品" : action === "deactivate" ? "后台下架商品" : "后台归档商品"
    }
  });
}

export function adminAdjustProductInventory(productId, variantId, payload) {
  return apiFetch(`/api/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/inventory`, {
    method: "POST",
    headers: { "idempotency-key": payload.idempotencyKey },
    body: payload
  });
}

export function adminAdjustMemberPoints(memberId, payload) {
  return apiFetch(`/api/admin/members/${encodeURIComponent(memberId)}/points`, {
    method: "POST",
    headers: { "idempotency-key": payload.idempotencyKey },
    body: payload
  });
}

export function adminGetPointsRedemptions() {
  return apiFetch("/api/admin/points-mall/redemptions");
}

export function adminPayOrder(orderId, payload) {
  return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/pay`, {
    method: "POST",
    headers: { "idempotency-key": payload.idempotencyKey },
    body: payload
  });
}

export function adminShipOrder(orderId, payload) {
  return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/ship`, {
    method: "POST",
    headers: { "idempotency-key": payload.idempotencyKey },
    body: payload
  });
}

export async function adminUploadProductImage(productId, file, options = {}) {
  const response = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/images/upload`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": file.type,
      "x-file-name": file.name,
      "x-image-alt": options.alt || "",
      "x-image-role": options.role || "gallery"
    },
    body: file
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "图片上传失败。");
  return payload;
}

export function adminDeleteProductImage(productId, imageId) {
  return apiFetch(`/api/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`, { method: "DELETE" });
}

export function adminCompleteOrder(orderId, idempotencyKey) {
  return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/complete`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: { idempotencyKey }
  });
}

export function adminRefundOrder(orderId, payload) {
  return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`, {
    method: "POST",
    headers: { "idempotency-key": payload.idempotencyKey },
    body: payload
  });
}

export function adminUpdateOrderStatus(orderId, payload) {
  return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PATCH",
    headers: { "idempotency-key": payload.idempotencyKey },
    body: payload
  });
}

export function adminSetMallItemStatus(itemId, action, idempotencyKey) {
  return apiFetch(`/api/admin/points-mall/items/${encodeURIComponent(itemId)}/${action}`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: { idempotencyKey }
  });
}

export function adminCreateMallItem(payload) {
  return apiFetch("/api/admin/points-mall/items", {
    method: "POST",
    headers: { "idempotency-key": payload.idempotencyKey },
    body: payload
  });
}

export function adminUpdateRedemptionStatus(redemptionId, payload) {
  return apiFetch(`/api/admin/points-mall/redemptions/${encodeURIComponent(redemptionId)}/status`, {
    method: "PATCH",
    headers: { "idempotency-key": payload.idempotencyKey },
    body: payload
  });
}

export function adminCancelRedemption(redemptionId, idempotencyKey) {
  return apiFetch(`/api/admin/points-mall/redemptions/${encodeURIComponent(redemptionId)}/cancel`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: {
      idempotencyKey,
      reason: "后台取消兑换"
    }
  });
}
