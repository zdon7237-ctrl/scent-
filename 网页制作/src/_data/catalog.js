const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dataPath = path.join(__dirname, "..", "assets", "data.js");
const source = readFileSync(dataPath, "utf8");
const sandbox = { window: {} };

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: dataPath });

const catalog = sandbox.window.SA_DATA || {
  products: [],
  brands: [],
  articles: []
};

function encodedId(id) {
  return encodeURIComponent(String(id || ""));
}

function entryPage(prefix, id) {
  return `${prefix}-${encodedId(id)}.html`;
}

module.exports = {
  ...catalog,
  productsForPages: (catalog.products || []).map((item) => ({
    ...item,
    pagePath: entryPage("product", item.id)
  })),
  brandsForPages: (catalog.brands || []).map((item) => ({
    ...item,
    pagePath: entryPage("brand", item.id)
  })),
  articlesForPages: (catalog.articles || []).map((item) => ({
    ...item,
    pagePath: entryPage("article", item.id)
  })),
  sitemapProducts: (catalog.products || []).map((item) => ({
    path: `products/${encodedId(item.slug || item.id)}`
  })),
  sitemapBrands: (catalog.brands || []).map((item) => ({
    path: entryPage("brand", item.id)
  })),
  sitemapArticles: (catalog.articles || []).map((item) => ({
    path: entryPage("article", item.id)
  }))
};
