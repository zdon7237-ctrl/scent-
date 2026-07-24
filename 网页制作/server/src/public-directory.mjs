import { existsSync } from "node:fs";
import path from "node:path";

export function resolvePublicDirectory(rootDir, configuredDir = process.env.PUBLIC_DIR) {
  const fallback = path.join(rootDir, "dist");
  const configured = String(configuredDir || "").trim();
  if (!configured) return fallback;

  const candidate = path.isAbsolute(configured)
    ? configured
    : path.resolve(rootDir, configured);
  return existsSync(path.join(candidate, "product.html")) ? candidate : fallback;
}
