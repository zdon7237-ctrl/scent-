export const catalogData = window.SA_DATA || {
  notes: [],
  scenes: [],
  products: [],
  brands: [],
  sampleSets: [],
  edits: [],
  articles: []
};

export const hasCatalogData = Boolean(window.SA_DATA);

export function sampleSetItems() {
  return catalogData.sampleSets.map((set) => ({
    ...set,
    brand: "Scent Atoll",
    category: "sample",
    country: "Curated",
    stock: "现货",
    concentration: "Sample Set",
    family: "试香套装",
    status: ["Sample"],
    description: set.intro,
    scenes: ["daily", "gift"],
    mood: ["clean"],
    sweetness: "medium"
  }));
}

export function allCatalogItems() {
  return [
    ...catalogData.products,
    ...sampleSetItems()
  ];
}

export function replaceCatalogProducts(products = [], options = {}) {
  if (!Array.isArray(products)) return false;
  catalogData.products = products;
  if (options.clearBundledSamples) catalogData.sampleSets = [];
  const notes = new Set(catalogData.notes || []);
  products.forEach((product) => (product.notes || []).forEach((note) => notes.add(note)));
  catalogData.notes = Array.from(notes);
  return true;
}

export function formatPrice(value) {
  return `¥${Number(value).toLocaleString("zh-CN")}`;
}

export function productById(id) {
  return catalogData.products.find((product) => product.id === id || product.productId === id);
}

export function brandById(id) {
  return catalogData.brands.find((brand) => brand.id === id);
}

export function articleById(id) {
  return catalogData.articles.find((article) => article.id === id);
}

export function catalogItemById(id) {
  return allCatalogItems().find((item) => item.id === id || item.productId === id);
}

export function canPurchase(item) {
  return Boolean(item && Number(item.price) > 0 && item.stock !== "售罄" && item.canPurchase !== false);
}

export function imageStyle(url) {
  return `style="--image: url('${url}')"`;
}

export function tagList(items = []) {
  return items.slice(0, 4).map((item) => `<span>${item}</span>`).join("");
}
