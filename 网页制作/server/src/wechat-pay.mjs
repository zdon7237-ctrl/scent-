import {
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign as rsaSign,
  verify as rsaVerify
} from "node:crypto";

export const WECHAT_PAY_API_BASE_URL = "https://api.mch.weixin.qq.com";
export const WECHAT_PAY_SIGNATURE_SCHEME = "WECHATPAY2-SHA256-RSA2048";
export const WECHAT_PAY_RESOURCE_ALGORITHM = "AEAD_AES_256_GCM";
// Keep refunds closed until request, callback, reconciliation, and recovery are wired end to end.
export const WECHAT_PAY_REFUNDS_SUPPORTED = false;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function pem(value) {
  return typeof value === "string" ? value.trim().replaceAll("\\n", "\n") : value;
}

function canonicalSerial(value) {
  return text(value).toUpperCase();
}

function normalizePlatformCertificates(config = {}) {
  const configured = Array.isArray(config.platformCertificates)
    ? config.platformCertificates
    : [];
  const certificates = configured.map((entry) => ({
    serialNumber: canonicalSerial(entry?.serialNumber),
    publicKey: pem(entry?.publicKey)
  }));

  if (config.platformCertificateSerialNumber || config.platformPublicKey) {
    certificates.push({
      serialNumber: canonicalSerial(config.platformCertificateSerialNumber),
      publicKey: pem(config.platformPublicKey)
    });
  }

  return certificates;
}

function normalizeConfig(config = {}) {
  const apiBaseUrl = text(config.apiBaseUrl) || WECHAT_PAY_API_BASE_URL;
  return {
    mchid: text(config.mchid),
    appid: text(config.appid),
    merchantSerialNumber: canonicalSerial(config.merchantSerialNumber),
    merchantPrivateKey: pem(config.merchantPrivateKey),
    apiV3Key: typeof config.apiV3Key === "string" ? config.apiV3Key : "",
    notifyUrl: text(config.notifyUrl),
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ""),
    userAgent: text(config.userAgent) || "scent-atoll-wechat-pay/1.0",
    platformCertificates: normalizePlatformCertificates(config)
  };
}

export function wechatPayConfigFromEnv(env = process.env) {
  return normalizeConfig({
    mchid: env.WECHAT_PAY_MCH_ID,
    appid: env.WECHAT_PAY_APP_ID,
    merchantSerialNumber: env.WECHAT_PAY_MERCHANT_SERIAL_NUMBER,
    merchantPrivateKey: env.WECHAT_PAY_MERCHANT_PRIVATE_KEY,
    apiV3Key: env.WECHAT_PAY_API_V3_KEY,
    notifyUrl: env.WECHAT_PAY_NOTIFY_URL,
    apiBaseUrl: env.WECHAT_PAY_API_BASE_URL,
    platformCertificateSerialNumber: env.WECHAT_PAY_PLATFORM_SERIAL_NUMBER,
    platformPublicKey: env.WECHAT_PAY_PLATFORM_PUBLIC_KEY
  });
}

function isRsaKey(value, keyFactory) {
  try {
    const key = keyFactory(value);
    return key.asymmetricKeyType === "rsa" &&
      (!key.asymmetricKeyDetails?.modulusLength || key.asymmetricKeyDetails.modulusLength >= 2048);
  } catch {
    return false;
  }
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function looksLikePlaceholder(value) {
  return /(?:change[-_ ]?me|placeholder|replace[-_ ]?me|your[-_ ]|xxx|dummy)/i.test(value);
}

export function validateWechatPayConfig(config, options = {}) {
  const normalized = normalizeConfig(config);
  const production = options.production ?? process.env.NODE_ENV === "production";
  const errors = [];

  for (const field of ["mchid", "appid", "merchantSerialNumber", "merchantPrivateKey", "apiV3Key", "notifyUrl"]) {
    if (!normalized[field]) errors.push(`${field} is required`);
  }

  if (normalized.mchid && !/^\d{8,32}$/.test(normalized.mchid)) {
    errors.push("mchid must contain 8 to 32 digits");
  }
  if (normalized.appid && !/^wx[A-Za-z0-9]{16}$/.test(normalized.appid)) {
    errors.push("appid must be a valid WeChat AppID");
  }
  if (normalized.merchantSerialNumber && !/^[0-9A-F]+$/.test(normalized.merchantSerialNumber)) {
    errors.push("merchantSerialNumber must be a hexadecimal certificate serial number");
  }
  if (normalized.merchantPrivateKey && !isRsaKey(normalized.merchantPrivateKey, createPrivateKey)) {
    errors.push("merchantPrivateKey must be an RSA key of at least 2048 bits");
  }
  if (normalized.apiV3Key && Buffer.byteLength(normalized.apiV3Key, "utf8") !== 32) {
    errors.push("apiV3Key must be exactly 32 UTF-8 bytes");
  }

  const notifyUrl = normalized.notifyUrl ? parseUrl(normalized.notifyUrl) : null;
  if (normalized.notifyUrl && (!notifyUrl || !["http:", "https:"].includes(notifyUrl.protocol) || notifyUrl.username || notifyUrl.password)) {
    errors.push("notifyUrl must be an absolute HTTP(S) URL without credentials");
  }

  const apiBaseUrl = parseUrl(normalized.apiBaseUrl);
  if (!apiBaseUrl || !["http:", "https:"].includes(apiBaseUrl.protocol) || apiBaseUrl.username || apiBaseUrl.password) {
    errors.push("apiBaseUrl must be an absolute HTTP(S) URL without credentials");
  } else if (apiBaseUrl.pathname !== "/" || apiBaseUrl.search || apiBaseUrl.hash) {
    errors.push("apiBaseUrl must not include a path, query string, or hash");
  }

  if (normalized.platformCertificates.length === 0) {
    errors.push("at least one platform certificate serial number and public key is required");
  }
  const seenSerials = new Set();
  for (const certificate of normalized.platformCertificates) {
    if (!certificate.serialNumber || !/^[0-9A-F]+$/.test(certificate.serialNumber)) {
      errors.push("platform certificate serialNumber must be hexadecimal");
    } else if (seenSerials.has(certificate.serialNumber)) {
      errors.push(`platform certificate serialNumber ${certificate.serialNumber} is duplicated`);
    } else {
      seenSerials.add(certificate.serialNumber);
    }
    if (!certificate.publicKey || !isRsaKey(certificate.publicKey, createPublicKey)) {
      errors.push("platform certificate publicKey must be an RSA key of at least 2048 bits");
    }
  }

  if (production) {
    if (notifyUrl?.protocol !== "https:") errors.push("notifyUrl must use HTTPS in production");
    if (apiBaseUrl?.protocol !== "https:") errors.push("apiBaseUrl must use HTTPS in production");
    if (apiBaseUrl?.origin !== WECHAT_PAY_API_BASE_URL) {
      errors.push(`apiBaseUrl must be ${WECHAT_PAY_API_BASE_URL} in production`);
    }
    for (const field of ["mchid", "appid", "merchantSerialNumber", "apiV3Key", "notifyUrl"]) {
      if (normalized[field] && looksLikePlaceholder(normalized[field])) {
        errors.push(`${field} must not contain placeholder text in production`);
      }
    }
  }

  return { valid: errors.length === 0, errors, config: normalized };
}

export function assertWechatPayConfig(config, options = {}) {
  const result = validateWechatPayConfig(config, options);
  if (!result.valid) {
    const error = new Error(`Invalid WeChat Pay configuration: ${result.errors.join("; ")}`);
    error.name = "WechatPayConfigError";
    error.errors = result.errors;
    throw error;
  }
  return result.config;
}

function requireString(value, name, maxLength = Infinity) {
  const normalized = text(value);
  if (!normalized) throw new TypeError(`${name} is required`);
  if (normalized.length > maxLength) throw new TypeError(`${name} is too long`);
  return normalized;
}

function requireToken(value, name, maxLength = 64) {
  const normalized = requireString(value, name, maxLength);
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new TypeError(`${name} contains unsupported characters`);
  }
  return normalized;
}

function requireTradeNumber(value, name) {
  const normalized = requireString(value, name, 32);
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new TypeError(`${name} may only contain letters, digits, underscores, and hyphens`);
  }
  return normalized;
}

function requireAmount(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer in fen`);
  }
  return value;
}

function requireCurrency(value = "CNY") {
  if (value !== "CNY") throw new TypeError("currency must be CNY");
  return value;
}

function setOptional(target, key, value) {
  if (value !== undefined && value !== null && value !== "") target[key] = value;
}

function commonOrderPayload(config, input) {
  const payload = {
    appid: requireString(config.appid, "appid"),
    mchid: requireString(config.mchid, "mchid"),
    description: requireString(input.description, "description", 127),
    out_trade_no: requireTradeNumber(input.outTradeNo, "outTradeNo"),
    notify_url: requireString(input.notifyUrl || config.notifyUrl, "notifyUrl"),
    amount: {
      total: requireAmount(input.total, "total"),
      currency: requireCurrency(input.currency)
    }
  };
  setOptional(payload, "time_expire", input.timeExpire);
  setOptional(payload, "attach", input.attach);
  setOptional(payload, "goods_tag", input.goodsTag);
  return payload;
}

export function buildJsapiOrderPayload(config, input = {}) {
  return {
    ...commonOrderPayload(config, input),
    payer: {
      openid: requireString(input.openid, "openid", 128)
    }
  };
}

export function buildH5OrderPayload(config, input = {}) {
  const h5Info = { type: requireString(input.h5Type, "h5Type", 32) };
  setOptional(h5Info, "app_name", input.appName);
  setOptional(h5Info, "app_url", input.appUrl);
  setOptional(h5Info, "bundle_id", input.bundleId);
  setOptional(h5Info, "package_name", input.packageName);

  const sceneInfo = {
    payer_client_ip: requireString(input.payerClientIp, "payerClientIp", 64),
    h5_info: h5Info
  };
  setOptional(sceneInfo, "device_id", input.deviceId);
  if (input.storeInfo !== undefined) sceneInfo.store_info = input.storeInfo;

  return {
    ...commonOrderPayload(config, input),
    scene_info: sceneInfo
  };
}

export function buildWechatPayRefundPayload(config, input = {}) {
  const hasOutTradeNo = Boolean(text(input.outTradeNo));
  const hasTransactionId = Boolean(text(input.transactionId));
  if (hasOutTradeNo === hasTransactionId) {
    throw new TypeError("provide exactly one of outTradeNo or transactionId");
  }

  const total = requireAmount(input.total, "total");
  const refund = requireAmount(input.refund, "refund");
  if (refund > total) throw new TypeError("refund must not exceed total");

  const payload = {
    out_refund_no: requireTradeNumber(input.outRefundNo, "outRefundNo"),
    notify_url: requireString(input.notifyUrl || config.notifyUrl, "notifyUrl"),
    amount: {
      refund,
      total,
      currency: requireCurrency(input.currency)
    }
  };
  if (hasOutTradeNo) payload.out_trade_no = requireTradeNumber(input.outTradeNo, "outTradeNo");
  if (hasTransactionId) payload.transaction_id = requireString(input.transactionId, "transactionId", 64);
  setOptional(payload, "reason", input.reason);
  setOptional(payload, "funds_account", input.fundsAccount);
  if (input.goodsDetail !== undefined) payload.goods_detail = input.goodsDetail;
  return payload;
}

function canonicalRequestTarget(value) {
  const target = requireString(value, "canonicalUrl");
  if (/[\r\n]/.test(target)) throw new TypeError("canonicalUrl must not contain newlines");
  if (target.startsWith("/")) return target;
  const parsed = parseUrl(target);
  if (!parsed) throw new TypeError("canonicalUrl must be a path or absolute URL");
  return `${parsed.pathname}${parsed.search}`;
}

export function buildWechatPaySignatureMessage(method, canonicalUrl, timestamp, nonce, body = "") {
  const normalizedMethod = requireString(method, "method").toUpperCase();
  if (!/^[A-Z]+$/.test(normalizedMethod)) throw new TypeError("method is invalid");
  const target = canonicalRequestTarget(canonicalUrl);
  const normalizedTimestamp = String(timestamp);
  if (!/^\d+$/.test(normalizedTimestamp)) throw new TypeError("timestamp must be Unix seconds");
  const normalizedNonce = requireToken(nonce, "nonce");
  return `${normalizedMethod}\n${target}\n${normalizedTimestamp}\n${normalizedNonce}\n${body}\n`;
}

export function signWechatPayRequest(options) {
  const message = buildWechatPaySignatureMessage(
    options.method,
    options.canonicalUrl,
    options.timestamp,
    options.nonce,
    options.body || ""
  );
  return rsaSign("RSA-SHA256", Buffer.from(message, "utf8"), pem(options.merchantPrivateKey)).toString("base64");
}

export function createWechatPayAuthorization(options) {
  const mchid = requireString(options.mchid, "mchid");
  if (!/^\d{8,32}$/.test(mchid)) throw new TypeError("mchid is invalid");
  const serialNumber = canonicalSerial(requireString(options.merchantSerialNumber, "merchantSerialNumber"));
  if (!/^[0-9A-F]+$/.test(serialNumber)) throw new TypeError("merchantSerialNumber is invalid");
  const nonce = requireToken(options.nonce, "nonce");
  const timestamp = String(options.timestamp);
  const signature = signWechatPayRequest(options);
  return `${WECHAT_PAY_SIGNATURE_SCHEME} mchid="${mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serialNumber}",signature="${signature}"`;
}

export function buildJsapiPaymentParameters(config, input = {}) {
  const appId = requireString(config.appid, "appid");
  const timeStamp = String(input.timestamp);
  if (!/^\d+$/.test(timeStamp)) throw new TypeError("timestamp must be Unix seconds");
  const nonceStr = requireToken(input.nonce, "nonce");
  const packageValue = `prepay_id=${requireString(input.prepayId, "prepayId", 128)}`;
  const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
  const paySign = rsaSign(
    "RSA-SHA256",
    Buffer.from(message, "utf8"),
    pem(config.merchantPrivateKey)
  ).toString("base64");
  return {
    appId,
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: "RSA",
    paySign
  };
}

function unixSeconds(value) {
  const milliseconds = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(milliseconds)) throw new TypeError("clock must return a Date or milliseconds");
  return Math.floor(milliseconds / 1000);
}

function orderLookupPath(config, input = {}) {
  const hasOutTradeNo = Boolean(text(input.outTradeNo));
  const hasTransactionId = Boolean(text(input.transactionId));
  if (hasOutTradeNo === hasTransactionId) {
    throw new TypeError("provide exactly one of outTradeNo or transactionId");
  }
  const mchid = encodeURIComponent(config.mchid);
  if (hasOutTradeNo) {
    return `/v3/pay/transactions/out-trade-no/${encodeURIComponent(requireTradeNumber(input.outTradeNo, "outTradeNo"))}?mchid=${mchid}`;
  }
  return `/v3/pay/transactions/id/${encodeURIComponent(requireString(input.transactionId, "transactionId", 64))}?mchid=${mchid}`;
}

export function createWechatPayClient(config, options = {}) {
  const normalized = assertWechatPayConfig(config, { production: options.production });
  const httpClient = options.httpClient || globalThis.fetch?.bind(globalThis);
  if (typeof httpClient !== "function") throw new TypeError("httpClient must be a fetch-compatible function");
  const clock = options.now || Date.now;
  const nonceSource = options.nonce || (() => randomBytes(16).toString("hex"));

  async function request(method, path, payload) {
    const body = payload === undefined ? "" : JSON.stringify(payload);
    const timestamp = unixSeconds(clock());
    const nonce = requireToken(nonceSource(), "nonce");
    const authorization = createWechatPayAuthorization({
      mchid: normalized.mchid,
      merchantSerialNumber: normalized.merchantSerialNumber,
      merchantPrivateKey: normalized.merchantPrivateKey,
      method,
      canonicalUrl: path,
      timestamp,
      nonce,
      body
    });
    const headers = {
      Accept: "application/json",
      Authorization: authorization,
      "User-Agent": normalized.userAgent
    };
    if (body) headers["Content-Type"] = "application/json";
    return httpClient(`${normalized.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body || undefined
    });
  }

  return Object.freeze({
    createJsapiOrder(input) {
      return request("POST", "/v3/pay/transactions/jsapi", buildJsapiOrderPayload(normalized, input));
    },
    createH5Order(input) {
      return request("POST", "/v3/pay/transactions/h5", buildH5OrderPayload(normalized, input));
    },
    createJsapiPaymentParameters(prepayId) {
      return buildJsapiPaymentParameters(normalized, {
        prepayId,
        timestamp: unixSeconds(clock()),
        nonce: nonceSource()
      });
    },
    queryOrder(input) {
      return request("GET", orderLookupPath(normalized, input));
    },
    closeOrder(outTradeNo) {
      const tradeNumber = requireTradeNumber(outTradeNo, "outTradeNo");
      return request(
        "POST",
        `/v3/pay/transactions/out-trade-no/${encodeURIComponent(tradeNumber)}/close`,
        { mchid: normalized.mchid }
      );
    },
    createRefund(input) {
      return request("POST", "/v3/refund/domestic/refunds", buildWechatPayRefundPayload(normalized, input));
    },
    queryRefund(outRefundNo) {
      const refundNumber = requireTradeNumber(outRefundNo, "outRefundNo");
      return request("GET", `/v3/refund/domestic/refunds/${encodeURIComponent(refundNumber)}`);
    },
    verifyAndDecryptCallback(input) {
      return verifyAndDecryptWechatPayCallback({
        ...input,
        config: normalized,
        now: input.now ?? clock()
      });
    }
  });
}

function headerValue(headers, name) {
  if (headers && typeof headers.get === "function") return text(headers.get(name));
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() !== wanted) continue;
    return text(Array.isArray(value) ? value[0] : value);
  }
  return "";
}

function rawBodyBuffer(rawBody) {
  if (typeof rawBody === "string") return Buffer.from(rawBody, "utf8");
  if (Buffer.isBuffer(rawBody)) return rawBody;
  if (rawBody instanceof Uint8Array) return Buffer.from(rawBody);
  throw new TypeError("rawBody must be the original string, Buffer, or Uint8Array");
}

export function verifyWechatPayCallbackSignature(options) {
  const timestamp = headerValue(options.headers, "Wechatpay-Timestamp");
  const nonce = headerValue(options.headers, "Wechatpay-Nonce");
  const signature = headerValue(options.headers, "Wechatpay-Signature");
  const serialNumber = canonicalSerial(headerValue(options.headers, "Wechatpay-Serial"));
  if (!timestamp || !nonce || !signature || !serialNumber) {
    throw new Error("Missing required WeChat Pay callback signature headers");
  }
  if (!/^\d+$/.test(timestamp)) throw new Error("Invalid WeChat Pay callback timestamp");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) throw new Error("Invalid WeChat Pay callback signature encoding");

  const currentTime = typeof options.now === "function" ? options.now() : options.now ?? Date.now();
  const nowSeconds = unixSeconds(currentTime);
  const toleranceSeconds = options.toleranceSeconds ?? 300;
  if (!Number.isFinite(toleranceSeconds) || toleranceSeconds < 0) {
    throw new TypeError("toleranceSeconds must be a non-negative number");
  }
  if (Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) {
    throw new Error("WeChat Pay callback timestamp is outside the allowed tolerance");
  }

  const certificates = normalizePlatformCertificates({
    platformCertificates: options.platformCertificates,
    platformCertificateSerialNumber: options.platformCertificateSerialNumber,
    platformPublicKey: options.platformPublicKey
  });
  const certificate = certificates.find((entry) => entry.serialNumber === serialNumber);
  if (!certificate?.publicKey) throw new Error(`Unknown WeChat Pay platform certificate serial number: ${serialNumber}`);

  const rawBody = rawBodyBuffer(options.rawBody);
  const message = Buffer.concat([
    Buffer.from(`${timestamp}\n${nonce}\n`, "utf8"),
    rawBody,
    Buffer.from("\n", "utf8")
  ]);
  const valid = rsaVerify(
    "RSA-SHA256",
    message,
    createPublicKey(certificate.publicKey),
    Buffer.from(signature, "base64")
  );
  if (!valid) throw new Error("Invalid WeChat Pay callback signature");
  return { valid: true, timestamp: Number(timestamp), nonce, serialNumber };
}

function decodeBase64(value, name) {
  const encoded = requireString(value, name);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error(`${name} must be valid base64`);
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length === 0) throw new Error(`${name} must not be empty`);
  return decoded;
}

export function decryptWechatPayResource(resource, apiV3Key) {
  if (!resource || resource.algorithm !== WECHAT_PAY_RESOURCE_ALGORITHM) {
    throw new Error(`WeChat Pay resource algorithm must be ${WECHAT_PAY_RESOURCE_ALGORITHM}`);
  }
  const key = Buffer.from(apiV3Key || "", "utf8");
  if (key.length !== 32) throw new Error("apiV3Key must be exactly 32 UTF-8 bytes");
  const nonce = Buffer.from(requireString(resource.nonce, "resource.nonce"), "utf8");
  if (nonce.length !== 12) throw new Error("resource.nonce must be 12 UTF-8 bytes");
  const encrypted = decodeBase64(resource.ciphertext, "resource.ciphertext");
  if (encrypted.length <= 16) throw new Error("resource.ciphertext is too short");
  const ciphertext = encrypted.subarray(0, -16);
  const authenticationTag = encrypted.subarray(-16);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(Buffer.from(resource.associated_data || "", "utf8"));
    decipher.setAuthTag(authenticationTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return JSON.parse(plaintext);
  } catch {
    throw new Error("Unable to authenticate or decrypt WeChat Pay callback resource");
  }
}

export function validateWechatPayTransaction(transaction, expected = {}) {
  const mchid = requireString(expected.mchid, "expected.mchid");
  const total = requireAmount(expected.total, "expected.total");
  const currency = requireCurrency(expected.currency);
  const mismatches = [];

  if (transaction?.mchid !== mchid) mismatches.push("mchid");
  if (transaction?.amount?.total !== total) mismatches.push("amount.total");
  if (transaction?.amount?.currency !== currency) mismatches.push("amount.currency");
  if (expected.appid !== undefined && transaction?.appid !== expected.appid) mismatches.push("appid");
  if (expected.outTradeNo !== undefined && transaction?.out_trade_no !== expected.outTradeNo) mismatches.push("out_trade_no");
  if (expected.transactionId !== undefined && transaction?.transaction_id !== expected.transactionId) mismatches.push("transaction_id");
  if (expected.refund !== undefined && transaction?.amount?.refund !== expected.refund) mismatches.push("amount.refund");
  if (expected.outRefundNo !== undefined && transaction?.out_refund_no !== expected.outRefundNo) mismatches.push("out_refund_no");

  return { valid: mismatches.length === 0, mismatches };
}

export function assertWechatPayTransaction(transaction, expected = {}) {
  const result = validateWechatPayTransaction(transaction, expected);
  if (!result.valid) {
    const error = new Error(`WeChat Pay transaction validation failed: ${result.mismatches.join(", ")}`);
    error.name = "WechatPayTransactionMismatchError";
    error.mismatches = result.mismatches;
    throw error;
  }
  return transaction;
}

export function extractWechatPayEventIdentifiers(event, resource = {}) {
  const eventId = requireString(event?.id, "event.id", 128);
  return {
    eventId,
    idempotencyKey: `wechatpay:event:${eventId}`,
    eventType: text(event.event_type) || null,
    resourceType: text(event.resource_type) || text(event.resource?.original_type) || null,
    transactionId: text(resource.transaction_id) || null,
    outTradeNo: text(resource.out_trade_no) || null,
    refundId: text(resource.refund_id) || null,
    outRefundNo: text(resource.out_refund_no) || null
  };
}

export function verifyAndDecryptWechatPayCallback(options) {
  const config = normalizeConfig(options.config);
  const verification = verifyWechatPayCallbackSignature({
    headers: options.headers,
    rawBody: options.rawBody,
    platformCertificates: config.platformCertificates,
    now: options.now,
    toleranceSeconds: options.toleranceSeconds
  });
  const rawBody = rawBodyBuffer(options.rawBody);
  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new Error("WeChat Pay callback body is not valid JSON");
  }
  const resource = decryptWechatPayResource(event.resource, config.apiV3Key);
  return {
    event,
    resource,
    identifiers: extractWechatPayEventIdentifiers(event, resource),
    verification
  };
}
