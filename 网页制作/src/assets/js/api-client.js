export async function apiFetch(path, options = {}) {
  const headers = Object.fromEntries(
    Object.entries({
      "content-type": "application/json",
      ...(options.headers || {})
    }).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
  const response = await fetch(path, {
    credentials: "same-origin",
    headers,
    ...options,
    body: options.body && typeof options.body !== "string"
      ? JSON.stringify(options.body)
      : options.body
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "请求失败。");
  }
  return payload;
}

export function moneyText(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}
