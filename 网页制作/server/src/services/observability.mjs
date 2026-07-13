import { randomUUID } from "node:crypto";
import {
  deploymentEnvironment,
  envString,
  isProductionEnvironment
} from "./runtime-config.mjs";

const sensitiveKey = /(?:password|passwd|secret|token|authorization|cookie|api[-_]?key|private[-_]?key|credential|session|otp|verification[-_]?code|reset[-_]?code)/i;

export function serializeError(error) {
  if (!(error instanceof Error)) {
    return { name: "Error", message: String(error) };
  }

  const serialized = {
    name: error.name,
    message: error.message
  };
  if (error.code !== undefined) serialized.code = error.code;
  if (error.stack) serialized.stack = error.stack;
  if (error.cause !== undefined) {
    serialized.cause = error.cause instanceof Error
      ? { name: error.cause.name, message: error.cause.message }
      : String(error.cause);
  }
  return serialized;
}

export function redactSensitive(value, seen = new WeakSet()) {
  if (value instanceof Error) return redactSensitive(serializeError(value), seen);
  if (typeof value === "bigint") return value.toString();
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, seen));
  }

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = sensitiveKey.test(key) ? "[REDACTED]" : redactSensitive(item, seen);
  }
  return result;
}

function defaultWrite(level, line) {
  const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
  console[method](line);
}

export function createLogger(options = {}) {
  const env = options.env || process.env;
  const service = String(options.service || "scent-atoll-api");
  const environment = options.environment || deploymentEnvironment(env);
  const clock = options.clock || (() => new Date());
  const write = options.write || defaultWrite;
  const baseFields = redactSensitive(options.base || {});

  function emit(level, message, fields = {}) {
    const safeFields = redactSensitive(fields);
    const payload = {
      ...baseFields,
      ...safeFields,
      timestamp: clock().toISOString(),
      level,
      service,
      environment,
      message: String(message)
    };
    write(level, JSON.stringify(payload), payload);
    return payload;
  }

  const logger = {
    debug(message, fields) {
      return emit("debug", message, fields);
    },
    info(message, fields) {
      return emit("info", message, fields);
    },
    warn(message, fields) {
      return emit("warn", message, fields);
    },
    error(message, fields) {
      return emit("error", message, fields);
    },
    child(fields = {}) {
      return createLogger({
        ...options,
        env,
        service,
        environment,
        clock,
        write,
        base: { ...baseFields, ...redactSensitive(fields) }
      });
    }
  };

  return Object.freeze(logger);
}

function validateWebhookUrl(value, production) {
  if (!value) return "";
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("ERROR_WEBHOOK_URL must be an absolute http(s) URL.");
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || (production && parsed.protocol !== "https:")) {
    throw new Error(`ERROR_WEBHOOK_URL must be an absolute ${production ? "HTTPS" : "http(s)"} URL.`);
  }
  return parsed.toString();
}

export function createErrorReporter(options = {}) {
  const env = options.env || process.env;
  const logger = options.logger || createLogger({ env });
  const webhookUrl = validateWebhookUrl(
    options.webhookUrl ?? envString(env, "ERROR_WEBHOOK_URL"),
    isProductionEnvironment(env)
  );
  const webhookToken = options.webhookToken ?? envString(env, "ERROR_WEBHOOK_TOKEN");
  const fetchImpl = options.fetch || globalThis.fetch;
  const clock = options.clock || (() => new Date());
  const idGenerator = options.idGenerator || randomUUID;

  async function capture(error, context = {}) {
    const incidentId = idGenerator();
    const safeContext = redactSensitive(context);
    const payload = {
      incidentId,
      timestamp: clock().toISOString(),
      environment: deploymentEnvironment(env),
      error: redactSensitive(serializeError(error)),
      context: safeContext
    };

    logger.error("application.error", payload);
    if (!webhookUrl) {
      return { incidentId, reported: false, transport: "runtime-log" };
    }

    if (typeof fetchImpl !== "function") {
      logger.warn("error_report.webhook_unavailable", { incidentId });
      return { incidentId, reported: false, transport: "runtime-log" };
    }

    try {
      const headers = { "content-type": "application/json" };
      if (webhookToken) headers.authorization = `Bearer ${webhookToken}`;
      const response = await fetchImpl(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`Error webhook returned HTTP ${response.status}.`);
      return { incidentId, reported: true, transport: "webhook" };
    } catch (reportingError) {
      logger.warn("error_report.webhook_failed", {
        incidentId,
        error: reportingError
      });
      return { incidentId, reported: false, transport: "runtime-log" };
    }
  }

  return Object.freeze({ capture });
}
