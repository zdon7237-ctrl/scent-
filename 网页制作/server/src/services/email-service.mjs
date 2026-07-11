import { createHash } from "node:crypto";
import { createLogger } from "./observability.mjs";
import {
  ServiceConfigurationError,
  envString,
  isProductionEnvironment
} from "./runtime-config.mjs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class EmailDeliveryError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "EmailDeliveryError";
    this.code = "EMAIL_DELIVERY_ERROR";
  }
}

export function buildEmailIdempotencyKey(type, stableParts) {
  const normalizedType = String(type || "email")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "email";
  const parts = Array.isArray(stableParts) ? stableParts : [stableParts];
  const digest = createHash("sha256")
    .update(JSON.stringify(parts.map((part) => String(part ?? ""))))
    .digest("hex");
  return `scent-atoll:${normalizedType}:${digest}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function requiredText(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new TypeError(`${label} is required.`);
  return text;
}

function recipient(value) {
  const email = requiredText(value, "to").toLowerCase();
  if (!emailPattern.test(email)) throw new TypeError("to must be a valid email address.");
  return email;
}

function actionUrl(value, label, production) {
  const text = requiredText(value, label);
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new TypeError(`${label} must be an absolute URL.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || (production && parsed.protocol !== "https:")) {
    throw new TypeError(`${label} must use ${production ? "https" : "http or https"}.`);
  }
  return parsed.toString();
}

function emailLayout({ title, greeting, paragraphs, action }) {
  const paragraphHtml = paragraphs.map((item) => `<p style="margin:0 0 16px">${escapeHtml(item)}</p>`).join("");
  const actionHtml = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 20px;background:#222;color:#fff;text-decoration:none">${escapeHtml(action.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222;line-height:1.6"><main style="max-width:560px;margin:auto;padding:32px 20px"><h1 style="font-size:22px">${escapeHtml(title)}</h1><p>${escapeHtml(greeting)}</p>${paragraphHtml}${actionHtml}<p style="color:#666">馥屿 Scent Atoll</p></main></body></html>`;
}

function recipientFingerprint(to) {
  return createHash("sha256").update(to).digest("hex").slice(0, 12);
}

async function defaultClientFactory(apiKey) {
  let module;
  try {
    module = await import("resend");
  } catch (error) {
    throw new EmailDeliveryError("Resend SDK is unavailable. Install the resend package.", { cause: error });
  }
  return new module.Resend(apiKey);
}

export function createEmailService(options = {}) {
  const env = options.env || process.env;
  const apiKey = options.apiKey ?? envString(env, "RESEND_API_KEY");
  const from = options.from ?? envString(env, "EMAIL_FROM", "RESEND_FROM_EMAIL");
  const replyTo = options.replyTo ?? envString(env, "EMAIL_REPLY_TO");
  const production = isProductionEnvironment(env);
  const logger = options.logger || createLogger({ env, service: "scent-atoll-email" });
  const clientFactory = options.clientFactory || defaultClientFactory;
  const missing = [!apiKey && "RESEND_API_KEY", !from && "EMAIL_FROM"].filter(Boolean);

  if (production && missing.length) {
    throw new ServiceConfigurationError("email", missing);
  }

  let clientPromise;
  async function getClient() {
    if (!clientPromise) clientPromise = Promise.resolve(clientFactory(apiKey));
    return clientPromise;
  }

  async function deliver({ type, to, subject, html, text, stableParts }) {
    const target = recipient(to);
    const idempotencyKey = buildEmailIdempotencyKey(type, stableParts);
    const logFields = {
      emailType: type,
      idempotencyKey,
      recipientFingerprint: recipientFingerprint(target)
    };

    if (missing.length) {
      logger.warn("email.delivery_skipped", { ...logFields, reason: "not_configured", missing });
      return { status: "skipped", reason: "not_configured", idempotencyKey };
    }

    let response;
    try {
      const client = await getClient();
      const payload = { from, to: target, subject, html, text };
      if (replyTo) payload.replyTo = replyTo;
      response = await client.emails.send(payload, {
        idempotencyKey,
        headers: { "Idempotency-Key": idempotencyKey }
      });
    } catch (error) {
      logger.error("email.delivery_failed", { ...logFields, error });
      if (error instanceof EmailDeliveryError) throw error;
      throw new EmailDeliveryError(`Failed to send ${type} email.`, { cause: error });
    }

    if (response?.error) {
      const error = new EmailDeliveryError(response.error.message || `Resend rejected ${type} email.`);
      logger.error("email.delivery_failed", { ...logFields, error });
      throw error;
    }

    logger.info("email.delivered", { ...logFields, providerMessageId: response?.data?.id || null });
    return {
      status: "sent",
      provider: "resend",
      providerMessageId: response?.data?.id || null,
      idempotencyKey
    };
  }

  return Object.freeze({
    sendVerification({ to, name, verificationUrl, verificationId, userId }) {
      const url = actionUrl(verificationUrl, "verificationUrl", production);
      const eventId = requiredText(verificationId, "verificationId");
      const ownerId = requiredText(userId || to, "userId");
      const greeting = name ? `${name}，你好：` : "你好：";
      return deliver({
        type: "email-verification",
        to,
        subject: "验证你的馥屿账号邮箱",
        html: emailLayout({
          title: "验证邮箱",
          greeting,
          paragraphs: ["请验证邮箱以完成账号设置。此链接仅供你本人使用。"],
          action: { label: "验证邮箱", url }
        }),
        text: `${greeting}\n请打开以下链接验证邮箱：${url}\n馥屿 Scent Atoll`,
        stableParts: [ownerId, eventId]
      });
    },

    sendPasswordReset({ to, name, resetUrl, resetId, userId }) {
      const url = actionUrl(resetUrl, "resetUrl", production);
      const eventId = requiredText(resetId, "resetId");
      const ownerId = requiredText(userId || to, "userId");
      const greeting = name ? `${name}，你好：` : "你好：";
      return deliver({
        type: "password-reset",
        to,
        subject: "重置你的馥屿账号密码",
        html: emailLayout({
          title: "重置密码",
          greeting,
          paragraphs: ["我们收到了密码重置请求。如果不是你本人操作，可以忽略这封邮件。"],
          action: { label: "重置密码", url }
        }),
        text: `${greeting}\n请打开以下链接重置密码：${url}\n馥屿 Scent Atoll`,
        stableParts: [ownerId, eventId]
      });
    },

    sendOrderConfirmation({ to, name, orderId, orderNumber, totalCents, currency = "CNY" }) {
      const stableOrderId = requiredText(orderId, "orderId");
      const displayNumber = requiredText(orderNumber || orderId, "orderNumber");
      if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
        throw new TypeError("totalCents must be a non-negative integer.");
      }
      if (currency !== "CNY") throw new TypeError("Only CNY orders are supported.");
      const greeting = name ? `${name}，你好：` : "你好：";
      const amount = `¥${(totalCents / 100).toFixed(2)}`;
      return deliver({
        type: "order-confirmation",
        to,
        subject: `订单 ${displayNumber} 已创建`,
        html: emailLayout({
          title: "订单已创建",
          greeting,
          paragraphs: [`订单号：${displayNumber}`, `订单金额：${amount}`, "请按照页面提示完成人工转账，客服核对后会更新订单状态。"]
        }),
        text: `${greeting}\n订单号：${displayNumber}\n订单金额：${amount}\n馥屿 Scent Atoll`,
        stableParts: [stableOrderId]
      });
    },

    sendShipmentNotification({
      to,
      name,
      orderId,
      orderNumber,
      shipmentId,
      carrier,
      trackingNumber,
      trackingUrl
    }) {
      const stableOrderId = requiredText(orderId, "orderId");
      const displayNumber = requiredText(orderNumber || orderId, "orderNumber");
      const stableShipmentId = requiredText(shipmentId || trackingNumber, "shipmentId");
      const displayCarrier = requiredText(carrier, "carrier");
      const displayTrackingNumber = requiredText(trackingNumber, "trackingNumber");
      const url = trackingUrl ? actionUrl(trackingUrl, "trackingUrl", production) : "";
      const greeting = name ? `${name}，你好：` : "你好：";
      return deliver({
        type: "shipment-notification",
        to,
        subject: `订单 ${displayNumber} 已发货`,
        html: emailLayout({
          title: "订单已发货",
          greeting,
          paragraphs: [`承运商：${displayCarrier}`, `物流单号：${displayTrackingNumber}`],
          action: url ? { label: "查看物流", url } : null
        }),
        text: `${greeting}\n订单 ${displayNumber} 已发货。\n承运商：${displayCarrier}\n物流单号：${displayTrackingNumber}${url ? `\n物流链接：${url}` : ""}\n馥屿 Scent Atoll`,
        stableParts: [stableOrderId, stableShipmentId]
      });
    }
  });
}
