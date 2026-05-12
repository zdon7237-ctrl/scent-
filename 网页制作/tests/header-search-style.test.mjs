import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readStylesheet(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("header search styles", () => {
  for (const stylesheet of ["styles.css", "src/assets/styles.css"]) {
    it(`${stylesheet} keeps the search label on one line`, () => {
      const css = readStylesheet(stylesheet);
      const match = css.match(/\.site-search span\s*\{(?<rules>[^}]*)\}/);

      assert.ok(match, "Expected .site-search span styles to exist");
      assert.match(match.groups.rules, /white-space:\s*nowrap;/);
      assert.match(match.groups.rules, /flex:\s*0\s+0\s+auto;/);
    });
  }
});
