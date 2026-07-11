import { apiFetch } from "./api-client.js";

let cachedSession;

export async function currentSession() {
  if (cachedSession) return cachedSession;
  try {
    cachedSession = await apiFetch("/api/auth/me");
  } catch {
    cachedSession = { user: null };
  }
  return cachedSession;
}

export function resetSessionCache() {
  cachedSession = null;
}

export async function registerMember(payload) {
  const result = await apiFetch("/api/auth/register", {
    method: "POST",
    body: payload
  });
  cachedSession = result;
  return result;
}

export function verifyEmail(token) {
  return apiFetch("/api/auth/verify-email", { method: "POST", body: { token } });
}

export function resendVerification(email) {
  return apiFetch("/api/auth/resend-verification", { method: "POST", body: { email } });
}

export function requestPasswordReset(email) {
  return apiFetch("/api/auth/request-password-reset", { method: "POST", body: { email } });
}

export function resetPassword(token, password) {
  return apiFetch("/api/auth/reset-password", { method: "POST", body: { token, password } });
}

export function revokeOtherSessions() {
  return apiFetch("/api/auth/sessions/revoke-others", { method: "POST" });
}

export function deleteMemberAccount(password) {
  return apiFetch("/api/member/account", { method: "DELETE", body: { password } });
}

export async function loginMember(payload) {
  const result = await apiFetch("/api/auth/login", {
    method: "POST",
    body: payload
  });
  cachedSession = result.accountType === "member" ? result : { user: null };
  return result;
}

export async function logoutMember() {
  const result = await apiFetch("/api/auth/logout", { method: "POST" });
  cachedSession = { user: null };
  return result;
}
