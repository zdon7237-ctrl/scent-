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

export const allCatalogItems = [
  ...catalogData.products,
  ...catalogData.sampleSets.map((set) => ({
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
  }))
];

export function formatPrice(value) {
  return `¥${Number(value).toLocaleString("zh-CN")}`;
}

export function productById(id) {
  return catalogData.products.find((product) => product.id === id);
}

export function brandById(id) {
  return catalogData.brands.find((brand) => brand.id === id);
}

export function articleById(id) {
  return catalogData.articles.find((article) => article.id === id);
}

export function catalogItemById(id) {
  return allCatalogItems.find((item) => item.id === id);
}

export function canPurchase(item) {
  return Boolean(item && Number(item.price) > 0 && item.stock !== "售罄");
}

export function imageStyle(url) {
  return `style="--image: url('${url}')"`;
}

export function tagList(items = []) {
  return items.slice(0, 4).map((item) => `<span>${item}</span>`).join("");
}
