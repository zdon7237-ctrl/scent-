import { canPurchase, catalogItemById } from "./catalog.js";

const STORAGE_KEY = "sa_cart";

function readCart() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function writeCart(cart) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

function cleanQuantity(value) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return 0;
  return Math.max(0, Math.floor(quantity));
}

function validatedItem(id) {
  const item = catalogItemById(id);
  if (!item) throw new Error("商品不存在，无法加入购物车。");
  if (!canPurchase(item)) throw new Error("当前商品暂不可购买。");
  return item;
}

export const cartStore = {
  getItems() {
    return Object.entries(readCart())
      .map(([id, qty]) => {
        const item = catalogItemById(id);
        const quantity = cleanQuantity(qty);
        if (!item || quantity <= 0) return null;
        return {
          id,
          item,
          qty: quantity,
          lineTotal: item.price * quantity
        };
      })
      .filter(Boolean);
  },

  addItem(id, quantity = 1) {
    const item = validatedItem(id);
    const cart = readCart();
    const nextQuantity = cleanQuantity(quantity);
    if (nextQuantity <= 0) return item;
    cart[id] = cleanQuantity(cart[id]) + nextQuantity;
    writeCart(cart);
    return item;
  },

  updateQuantity(id, quantity) {
    const cart = readCart();
    const nextQuantity = cleanQuantity(quantity);
    if (nextQuantity <= 0) {
      delete cart[id];
      writeCart(cart);
      return null;
    }
    validatedItem(id);
    cart[id] = nextQuantity;
    writeCart(cart);
    return catalogItemById(id);
  },

  changeQuantity(id, delta) {
    const cart = readCart();
    const currentQuantity = cleanQuantity(cart[id]);
    return this.updateQuantity(id, currentQuantity + Number(delta));
  },

  removeItem(id) {
    const cart = readCart();
    delete cart[id];
    writeCart(cart);
  },

  clear() {
    writeCart({});
  },

  getCount() {
    return this.getItems().reduce((sum, entry) => sum + entry.qty, 0);
  },

  getSubtotal() {
    return this.getItems().reduce((sum, entry) => sum + entry.lineTotal, 0);
  }
};
