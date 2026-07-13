export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.status = Number(options.status || 0);
    this.code = options.code || "API_ERROR";
    this.path = options.path || "";
  }
}

export async function apiFetch(path, options = {}) {
  const headers = Object.fromEntries(
    Object.entries({
      "content-type": "application/json",
      ...(options.headers || {})
    }).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
  let response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers,
      body: options.body && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body
    });
  } catch (cause) {
    throw new ApiError("网络连接失败，请检查网络后重试。", {
      cause,
      code: "NETWORK_ERROR",
      path
    });
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.error || "请求失败。", {
      status: response.status,
      code: payload.code || "API_ERROR",
      path
    });
  }
  return payload;
}

export function moneyText(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}
