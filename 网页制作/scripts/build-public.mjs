import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import "./generate-og-image.mjs";
import { loadProductionEnv } from "./load-env.mjs";
import { projectRoot } from "./paths.mjs";

loadProductionEnv();
const outputDir = process.env.PUBLIC_OUTPUT_DIR || "dist-public";
const outputPath = path.resolve(projectRoot, outputDir);
const eleventyBin = path.join(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "eleventy.cmd" : "eleventy");

if (!existsSync(eleventyBin)) {
  throw new Error("Eleventy binary not found. Run npm ci before building the public site.");
}

await rm(outputPath, { recursive: true, force: true });
await mkdir(outputPath, { recursive: true });

execFileSync(eleventyBin, [], {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    PUBLIC_BUILD: "true",
    ELEVENTY_OUTPUT: outputDir
  }
});

await build({
  entryPoints: [path.join(projectRoot, "src/assets/js/public-app.js")],
  outfile: path.join(outputPath, "script.js"),
  bundle: true,
  format: "iife",
  target: ["es2018"],
  sourcemap: false,
  minify: true,
  legalComments: "none"
});

const privateFiles = [
  "admin.html",
  "account.html",
  "login.html",
  "register.html",
  "member.html",
  "membership.html",
  "checkout.html",
  "verify-email.html",
  "reset-password.html",
  "orders.html",
  "points.html",
  "points-mall.html",
  "points-item.html",
  "points-redemptions.html"
];

const privateRoutePattern = /^(?:admin|account|login|register|member|membership|checkout|verify-email|reset-password|orders|points)(?:[-.]|$)/;

await Promise.all(privateFiles.map((file) => rm(path.join(outputPath, file), { force: true })));
const topLevelOutputFiles = await readdir(outputPath, { withFileTypes: true });
await Promise.all(topLevelOutputFiles
  .filter((entry) => entry.isFile() && entry.name.endsWith(".html") && privateRoutePattern.test(entry.name))
  .map((entry) => rm(path.join(outputPath, entry.name), { force: true })));
await rm(path.join(outputPath, "assets", "js"), { recursive: true, force: true });
await writeFile(path.join(outputPath, ".nojekyll"), "");

console.log(`Public launch build written to ${outputDir}/`);
