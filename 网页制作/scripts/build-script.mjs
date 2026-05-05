import { build } from "esbuild";

await build({
  entryPoints: ["src/assets/js/app.js"],
  outfile: "src/assets/script.js",
  bundle: true,
  format: "iife",
  target: ["es2018"],
  sourcemap: false
});
