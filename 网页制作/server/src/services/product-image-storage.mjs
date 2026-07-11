import { randomUUID } from "node:crypto";
import { createLogger } from "./observability.mjs";
import {
  ServiceConfigurationError,
  envString,
  isProductionEnvironment
} from "./runtime-config.mjs";

const defaultMaxBytes = 5 * 1024 * 1024;
const mimeExtensions = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"]
]);

export class ProductImageStorageError extends Error {
  constructor(message, code = "PRODUCT_IMAGE_STORAGE_ERROR", options = {}) {
    super(message, options);
    this.name = "ProductImageStorageError";
    this.code = code;
  }
}

function normalizeMime(value) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

function bodySize(body) {
  if (typeof body?.size === "number") return body.size;
  if (typeof body?.byteLength === "number") return body.byteLength;
  return NaN;
}

async function bytesForSniffing(body) {
  if (body instanceof ArrayBuffer) return new Uint8Array(body).subarray(0, 32);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, Math.min(body.byteLength, 32));
  if (typeof body?.slice === "function" && typeof body?.arrayBuffer === "function") {
    return new Uint8Array(await body.slice(0, 32).arrayBuffer());
  }
  return null;
}

export function detectImageMime(bytes) {
  if (!bytes || bytes.length < 4) return "";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(4, 12)).startsWith("ftyp") && ["avif", "avis"].includes(String.fromCharCode(...bytes.subarray(8, 12)))) return "image/avif";
  return "";
}

export async function validateProductImageUpload({ body, contentType, maxBytes = defaultMaxBytes }) {
  const mime = normalizeMime(contentType);
  if (!mimeExtensions.has(mime)) {
    throw new TypeError(`Unsupported product image MIME type: ${mime || "missing"}.`);
  }
  const size = bodySize(body);
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new TypeError("Product image body must expose a positive byte size.");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError("maxBytes must be a positive integer.");
  }
  if (size > maxBytes) {
    throw new TypeError(`Product image exceeds the ${maxBytes} byte limit.`);
  }
  const detectedMime = detectImageMime(await bytesForSniffing(body));
  if (!detectedMime) throw new TypeError("Product image content could not be recognized.");
  if (detectedMime !== mime) {
    throw new TypeError(`Product image content is ${detectedMime}, not ${mime}.`);
  }
  return { contentType: mime, extension: mimeExtensions.get(mime), size };
}

function safePathSegment(value, label) {
  const text = String(value || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(text)) {
    throw new TypeError(`${label} contains invalid path characters.`);
  }
  return text;
}

function safeBaseName(fileName) {
  const raw = String(fileName || "image").trim().replace(/\.[^.]+$/, "");
  const safe = raw
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return safe || "image";
}

export function buildProductImagePath({ productId, fileName, contentType, uniqueId = randomUUID() }) {
  const product = safePathSegment(productId, "productId");
  const id = safePathSegment(String(uniqueId).replaceAll("-", ""), "uniqueId");
  const mime = normalizeMime(contentType);
  const extension = mimeExtensions.get(mime);
  if (!extension) throw new TypeError(`Unsupported product image MIME type: ${mime || "missing"}.`);
  return `products/${product}/${id}-${safeBaseName(fileName)}.${extension}`;
}

export function validateProductImageBlobUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    throw new TypeError("Product image URL must be an absolute Vercel Blob URL.");
  }
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".blob.vercel-storage.com")) {
    throw new TypeError("Product image URL must be an HTTPS Vercel Blob URL.");
  }
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
  } catch {
    throw new TypeError("Product image URL contains an invalid path.");
  }
  if (!decodedPath.startsWith("products/") || decodedPath.split("/").some((part) => part === ".." || part === ".")) {
    throw new TypeError("Product image URL is outside the products path.");
  }
  return parsed.toString();
}

async function defaultBlobLoader() {
  try {
    return await import("@vercel/blob");
  } catch (error) {
    throw new ProductImageStorageError(
      "Vercel Blob SDK is unavailable. Install the @vercel/blob package.",
      "BLOB_SDK_UNAVAILABLE",
      { cause: error }
    );
  }
}

export function createProductImageStorage(options = {}) {
  const env = options.env || process.env;
  const token = options.token ?? envString(env, "BLOB_READ_WRITE_TOKEN");
  const production = isProductionEnvironment(env);
  const logger = options.logger || createLogger({ env, service: "scent-atoll-product-images" });
  const loadBlob = options.loadBlob || defaultBlobLoader;
  const maxBytes = options.maxBytes || defaultMaxBytes;
  const idGenerator = options.idGenerator || randomUUID;

  if (production && !token) {
    throw new ServiceConfigurationError("product-image-storage", ["BLOB_READ_WRITE_TOKEN"]);
  }

  let blobPromise;
  async function provider() {
    if (!token) {
      throw new ServiceConfigurationError("product-image-storage", ["BLOB_READ_WRITE_TOKEN"]);
    }
    if (!blobPromise) blobPromise = Promise.resolve().then(() => loadBlob());
    let blob;
    try {
      blob = await blobPromise;
    } catch (error) {
      if (error instanceof ProductImageStorageError) throw error;
      throw new ProductImageStorageError(
        "Vercel Blob SDK is unavailable. Install the @vercel/blob package.",
        "BLOB_SDK_UNAVAILABLE",
        { cause: error }
      );
    }
    if (typeof blob?.put !== "function" || typeof blob?.del !== "function") {
      throw new ProductImageStorageError("Vercel Blob provider must expose put and del functions.", "BLOB_PROVIDER_INVALID");
    }
    return blob;
  }

  return Object.freeze({
    async upload({ productId, fileName, contentType, body }) {
      const validated = await validateProductImageUpload({ body, contentType, maxBytes });
      const pathname = buildProductImagePath({
        productId,
        fileName,
        contentType: validated.contentType,
        uniqueId: idGenerator()
      });
      const blob = await provider();
      let result;
      try {
        result = await blob.put(pathname, body, {
          access: "public",
          addRandomSuffix: false,
          token
        });
      } catch (error) {
        logger.error("product_image.upload_failed", { pathname, error });
        throw new ProductImageStorageError("Failed to upload product image.", "BLOB_UPLOAD_FAILED", { cause: error });
      }
      const url = validateProductImageBlobUrl(result?.url);
      logger.info("product_image.uploaded", { pathname, size: validated.size, contentType: validated.contentType });
      return {
        url,
        pathname: result?.pathname || pathname,
        contentType: validated.contentType,
        size: validated.size
      };
    },

    async remove({ url }) {
      const safeUrl = validateProductImageBlobUrl(url);
      const blob = await provider();
      try {
        await blob.del(safeUrl, { token });
      } catch (error) {
        logger.error("product_image.delete_failed", { url: safeUrl, error });
        throw new ProductImageStorageError("Failed to delete product image.", "BLOB_DELETE_FAILED", { cause: error });
      }
      logger.info("product_image.deleted", { url: safeUrl });
      return { deleted: true, url: safeUrl };
    }
  });
}
