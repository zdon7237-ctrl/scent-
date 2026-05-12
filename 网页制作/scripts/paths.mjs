import { fileURLToPath } from "node:url";
import path from "node:path";

export const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(scriptsDir, "..");
export const repoRoot = path.resolve(projectRoot, "..");
