import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadProductionEnv } from "./load-env.mjs";
import "./build-script.mjs";
import { projectRoot } from "./paths.mjs";

loadProductionEnv();

const eleventyBin = path.join(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "eleventy.cmd" : "eleventy");

if (!existsSync(eleventyBin)) {
  throw new Error("Eleventy binary not found. Run npm ci before building the site.");
}

execFileSync(eleventyBin, [], {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env
});
