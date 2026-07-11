import { createHash } from "node:crypto";
import { createLogger } from "./observability.mjs";
import {
  ServiceConfigurationError,
  envString,
  isProductionEnvironment
} from "./runtime-config.mjs";

const defaultWindowMs = 15 * 60 * 1000;
const incrementScript = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
local ttl = redis.call("PTTL", KEYS[1])
return {current, ttl}
`.trim();

export class LoginRateLimitError extends Error {
  constructor(message, code = "LOGIN_RATE_LIMIT_ERROR", options = {}) {
    super(message, options);
    this.name = "LoginRateLimitError";
    this.code = code;
  }
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${label} must be a positive integer.`);
  return value;
}

function normalizedScope(value) {
  const scope = String(value || "member").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,40}$/.test(scope)) throw new TypeError("scope contains invalid characters.");
  return scope;
}

function digest(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 32);
}

export function buildLoginRateLimitKeys({ ip, login, scope = "member" }) {
  const realm = normalizedScope(scope);
  const keys = [];
  const normalizedLogin = String(login || "").trim().toLowerCase();
  const normalizedIp = String(ip || "").trim().toLowerCase();
  if (normalizedLogin) keys.push({ dimension: "account", key: `scent-atoll:login:${realm}:account:${digest(normalizedLogin)}` });
  if (normalizedIp) keys.push({ dimension: "ip", key: `scent-atoll:login:${realm}:ip:${digest(normalizedIp)}` });
  if (!keys.length) throw new TypeError("login or ip is required for rate limiting.");
  return keys;
}

export function createMemoryRateLimitStore(options = {}) {
  const clock = options.clock || (() => Date.now());
  const entries = new Map();

  return {
    async consume(key, windowMs) {
      const timestamp = clock();
      const existing = entries.get(key);
      const entry = !existing || existing.expiresAt <= timestamp
        ? { count: 0, expiresAt: timestamp + windowMs }
        : existing;
      entry.count += 1;
      entries.set(key, entry);
      return { count: entry.count, ttlMs: Math.max(0, entry.expiresAt - timestamp) };
    },
    async clear(keys) {
      for (const key of keys) entries.delete(key);
    }
  };
}

function validateUpstashUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new ServiceConfigurationError("login-rate-limiter", ["UPSTASH_REDIS_REST_URL"], "UPSTASH_REDIS_REST_URL must be an absolute HTTPS URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new ServiceConfigurationError("login-rate-limiter", ["UPSTASH_REDIS_REST_URL"], "UPSTASH_REDIS_REST_URL must use HTTPS.");
  }
  return parsed.toString().replace(/\/$/, "");
}

function createUpstashStore({ url, token, fetchImpl }) {
  async function command(body) {
    let response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      throw new LoginRateLimitError("Upstash rate limit request failed.", "RATE_LIMIT_BACKEND_ERROR", { cause: error });
    }
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new LoginRateLimitError("Upstash returned an invalid response.", "RATE_LIMIT_BACKEND_ERROR", { cause: error });
    }
    if (!response.ok || payload?.error) {
      throw new LoginRateLimitError(
        payload?.error || `Upstash returned HTTP ${response.status}.`,
        "RATE_LIMIT_BACKEND_ERROR"
      );
    }
    return payload.result;
  }

  return {
    async consume(key, windowMs) {
      const result = await command(["EVAL", incrementScript, "1", key, String(windowMs)]);
      if (!Array.isArray(result) || result.length < 2) {
        throw new LoginRateLimitError("Upstash returned an invalid rate limit result.", "RATE_LIMIT_BACKEND_ERROR");
      }
      const count = Number(result[0]);
      const ttlMs = Number(result[1]);
      if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) {
        throw new LoginRateLimitError("Upstash returned an invalid rate limit result.", "RATE_LIMIT_BACKEND_ERROR");
      }
      return { count, ttlMs: ttlMs > 0 ? ttlMs : windowMs };
    },
    async clear(keys) {
      if (keys.length) await command(["DEL", ...keys]);
    }
  };
}

export function createLoginRateLimiter(options = {}) {
  const env = options.env || process.env;
  const urlValue = options.upstashUrl ?? envString(env, "UPSTASH_REDIS_REST_URL");
  const token = options.upstashToken ?? envString(env, "UPSTASH_REDIS_REST_TOKEN");
  const hasUrl = Boolean(urlValue);
  const hasToken = Boolean(token);
  const production = isProductionEnvironment(env);
  const logger = options.logger || createLogger({ env, service: "scent-atoll-login-rate-limit" });
  const fetchImpl = options.fetch || globalThis.fetch;
  const windowMs = positiveInteger(options.windowMs || defaultWindowMs, "windowMs");
  const accountLimit = positiveInteger(options.accountLimit || 5, "accountLimit");
  const ipLimit = positiveInteger(options.ipLimit || 20, "ipLimit");
  const clock = options.clock || (() => Date.now());

  if (hasUrl !== hasToken) {
    const missing = [!hasUrl && "UPSTASH_REDIS_REST_URL", !hasToken && "UPSTASH_REDIS_REST_TOKEN"].filter(Boolean);
    throw new ServiceConfigurationError("login-rate-limiter", missing, "Upstash REST URL and token must be configured together.");
  }
  if (production && !hasUrl) {
    throw new ServiceConfigurationError("login-rate-limiter", [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN"
    ]);
  }

  let backend = "memory";
  let store = options.store;
  if (!store && hasUrl) {
    if (typeof fetchImpl !== "function") {
      throw new ServiceConfigurationError("login-rate-limiter", [], "A fetch implementation is required for Upstash REST.");
    }
    store = createUpstashStore({ url: validateUpstashUrl(urlValue), token, fetchImpl });
    backend = "upstash";
  } else if (!store) {
    store = createMemoryRateLimitStore({ clock });
    logger.warn("login_rate_limit.memory_fallback", { environment: env.DEPLOYMENT_ENV || env.NODE_ENV || "development" });
  } else {
    backend = options.backend || "custom";
  }

  function descriptors(input) {
    return buildLoginRateLimitKeys(input).map((item) => ({
      ...item,
      limit: item.dimension === "account" ? accountLimit : ipLimit
    }));
  }

  return Object.freeze({
    backend,
    async consume(input) {
      const buckets = await Promise.all(descriptors(input).map(async (item) => {
        const result = await store.consume(item.key, windowMs);
        const allowed = result.count <= item.limit;
        return {
          dimension: item.dimension,
          allowed,
          limit: item.limit,
          remaining: Math.max(0, item.limit - result.count),
          retryAfterMs: allowed ? 0 : Math.max(1, result.ttlMs),
          resetAt: new Date(clock() + Math.max(0, result.ttlMs)).toISOString()
        };
      }));
      const allowed = buckets.every((item) => item.allowed);
      const retryAfterMs = Math.max(0, ...buckets.filter((item) => !item.allowed).map((item) => item.retryAfterMs));
      if (!allowed) {
        logger.warn("login_rate_limit.blocked", {
          scope: normalizedScope(input.scope),
          dimensions: buckets.filter((item) => !item.allowed).map((item) => item.dimension),
          retryAfterMs
        });
      }
      return { allowed, retryAfterMs, backend, buckets };
    },
    async clear(input, clearOptions = {}) {
      const dimensions = clearOptions.dimensions || ["account"];
      const allowedDimensions = new Set(["account", "ip"]);
      if (!Array.isArray(dimensions) || !dimensions.length || dimensions.some((item) => !allowedDimensions.has(item))) {
        throw new TypeError("dimensions must contain account and/or ip.");
      }
      await store.clear(
        descriptors(input)
          .filter((item) => dimensions.includes(item.dimension))
          .map((item) => item.key)
      );
    }
  });
}
