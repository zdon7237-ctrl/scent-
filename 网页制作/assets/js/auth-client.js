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

export async function loginMember(payload) {
  const result = await apiFetch("/api/auth/login", {
    method: "POST",
    body: payload
  });
  cachedSession = result;
  return result;
}

export async function logoutMember() {
  const result = await apiFetch("/api/auth/logout", { method: "POST" });
  cachedSession = { user: null };
  return result;
}
