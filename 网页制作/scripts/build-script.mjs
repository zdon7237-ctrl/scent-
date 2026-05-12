import { build } from "esbuild";
import path from "node:path";
import "./generate-og-image.mjs";
import { loadProductionEnv } from "./load-env.mjs";
import { projectRoot } from "./paths.mjs";

loadProductionEnv();

await build({
  entryPoints: [path.join(projectRoot, "src/assets/js/app.js")],
  outfile: path.join(projectRoot, "src/assets/script.js"),
  bundle: true,
  format: "iife",
  target: ["es2018"],
  sourcemap: false
});
