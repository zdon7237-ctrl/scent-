import { randomUUID, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { hasDatabaseUrl, withPgTransaction } from "./db.mjs";

const defaultSeedAdminPassword = ["dev", "admin"].join("-");
const modulePath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(modulePath);
const rootDir = path.resolve(__dirname, "../..");

function hashPassword(password) {
  const salt = randomUUID().replaceAll("-", "");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function defaultMemberTiers() {
  return [
    ["base", "普通会员", 0, 1, 1, 59900, 1],
    ["silver", "银卡会员", 100000, 0.95, 1.1, 49900, 2],
    ["gold", "金卡会员", 1000000, 0.92, 1.2, 39900, 3],
    ["diamond", "钻卡会员", 2000000, 0.88, 1.5, 0, 4],
    ["black", "黑卡会员", 5000000, 0.85, 2, 0, 5],
    ["supreme", "至尊会员", 20000000, 0.8, 2, 0, 6]
  ];
}

export function defaultPointsMallItems() {
  return [
    ["pm-random-sample-1", null, "官方随机小样 1 支", "由后台根据库存随机发出 1 支官方小样，适合低积分试用。", "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=1200&q=82", 300, 50, "active", 1],
    ["pm-random-sample-3", null, "官方随机小样 3 支", "由后台根据库存随机发出 3 支官方小样，适合想一次试更多气味的会员。", "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=1200&q=82", 800, 30, "active", 2],
    ["pm-tea-official-samples", null, "茶香官方小样组合", "围绕茶香方向搭配的官方小样组合，适合喜欢红茶、乌龙和低甜香气的会员。", "https://images.unsplash.com/photo-1615634260167-c8cdede054de?auto=format&fit=crop&w=1200&q=82", 600, 30, "active", 3],
    ["pm-tea-sample", "tea-sample", "茶香主题试香套装", "从清透乌龙到温柔红茶，适合低甜度和东方感偏好。", "", 1600, 10, "active", 4],
    ["pm-wood-sample", "wood-sample", "木质与焚香试香套装", "偏冷感、雨天和树脂质地，适合想找更成熟气味的人。", "", 1800, 10, "active", 5]
  ];
}

function loadCatalogProducts() {
  const source = path.join(rootDir, "src/assets/data.js");
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(source, "utf8"), sandbox);
  return sandbox.window.SA_DATA?.products || [];
}

function productRowsFromCatalog() {
  return loadCatalogProducts().map((item, index) => ({
    id: `product-${item.id}`,
    slug: item.id,
    name: item.name,
    brandName: item.brand || null,
    brandId: item.brandId || null,
    category: item.category || "fragrance",
    country: item.country || null,
    status: item.stock === "售罄" ? "inactive" : "active",
    description: item.description || null,
    volume: item.volume || null,
    concentration: item.concentration || null,
    stockLabel: item.stock || "现货",
    year: item.year || null,
    perfumer: item.perfumer || null,
    family: item.family || null,
    notes: JSON.stringify(item.notes || []),
    scenes: JSON.stringify(item.scenes || []),
    mood: JSON.stringify(item.mood || []),
    sweetness: item.sweetness || null,
    statusTags: JSON.stringify(item.status || []),
    heroImageUrl: item.image || null,
    imageLayout: "grid",
    buyerNote: item.buyer || null,
    bestFor: item.bestFor || null,
    caution: item.caution || null,
    topNotes: item.top || null,
    middleNotes: item.middle || null,
    baseNotes: item.base || null,
    sortOrder: index + 1,
    variantId: `variant-${item.id}-default`,
    sku: `${item.id}-default`,
    variantName: item.volume || "默认规格",
    priceAmount: Math.round(Number(item.price || 0) * 100),
    imageId: `image-${item.id}-hero`,
    imageAlt: `${item.name} 商品图`,
    inventoryId: `inventory-${item.id}-default`,
    quantityOnHand: item.stock === "售罄" ? 0 : item.stock === "少量" ? 3 : item.stock === "限量" ? 2 : 12
  }));
}

async function findProductIdBySlug(client, slug, fallbackId) {
  const result = await client.query("select id from products where slug = $1", [slug]);
  return result.rows[0]?.id || fallbackId;
}

export async function seed(options = {}) {
  if (!hasDatabaseUrl()) {
    return { skipped: true, reason: "DATABASE_URL is not set." };
  }

  const includeAdmin = options.includeAdmin !== false;
  const isProduction = process.env.NODE_ENV === "production";
  const seedAdminEmail = String(process.env.SEED_ADMIN_EMAIL || "admin@scent.local").trim().toLowerCase();
  const seedAdminPassword = String(process.env.SEED_ADMIN_PASSWORD || (isProduction ? "" : defaultSeedAdminPassword));
  const seedAdminRole = String(process.env.SEED_ADMIN_ROLE || "owner").trim().toLowerCase();

  if (isProduction && includeAdmin) {
    throw new Error("生产环境不能运行开发 seed 管理员流程；请分别使用 commerce 与 owner 一次性 bootstrap。");
  }

  return withPgTransaction(async (client) => {
    for (const [code, name, minAmount, discountRate, pointMultiplier, shippingAmount, sortOrder] of defaultMemberTiers()) {
      await client.query(
        `insert into member_tiers (
          id, code, name, min_lifetime_paid_amount, discount_rate, point_multiplier,
          free_shipping_threshold_amount, sort_order, is_active
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,true)
        on conflict (code) do update set
          name = excluded.name,
          min_lifetime_paid_amount = excluded.min_lifetime_paid_amount,
          discount_rate = excluded.discount_rate,
          point_multiplier = excluded.point_multiplier,
          free_shipping_threshold_amount = excluded.free_shipping_threshold_amount,
          sort_order = excluded.sort_order,
          updated_at = now()`,
        [`tier-${code}`, code, name, minAmount, discountRate, pointMultiplier, shippingAmount, sortOrder]
      );
    }

    for (const item of productRowsFromCatalog()) {
      await client.query(
        `insert into products (
          id, slug, name, brand_name, brand_id, category, country, status, description,
          volume, concentration, stock_label, year, perfumer, family, notes, scenes, mood,
          sweetness, status_tags, hero_image_url, image_layout, buyer_note, best_for, caution,
          top_notes, middle_notes, base_notes, sort_order
        )
        values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18::jsonb,
          $19,$20::jsonb,$21,$22,$23,$24,$25,$26,$27,$28,$29
        )
        on conflict (slug) do nothing`,
        [
          item.id, item.slug, item.name, item.brandName, item.brandId, item.category, item.country, item.status,
          item.description, item.volume, item.concentration, item.stockLabel, item.year, item.perfumer, item.family,
          item.notes, item.scenes, item.mood, item.sweetness, item.statusTags, item.heroImageUrl, item.imageLayout,
          item.buyerNote, item.bestFor, item.caution, item.topNotes, item.middleNotes, item.baseNotes, item.sortOrder
        ]
      );

      const productId = await findProductIdBySlug(client, item.slug, item.id);

      await client.query(
        `insert into product_variants (id, product_id, sku, name, price_amount, status)
         values ($1,$2,$3,$4,$5,'active')
         on conflict (sku) do nothing`,
        [item.variantId, productId, item.sku, item.variantName, item.priceAmount]
      );

      if (item.heroImageUrl) {
        await client.query(
          `insert into product_images (id, product_id, image_url, alt, role, sort_order)
           values ($1,$2,$3,$4,'hero',1)
           on conflict (id) do nothing`,
          [item.imageId, productId, item.heroImageUrl, item.imageAlt]
        );
      }

      await client.query(
        `insert into inventory_items (id, variant_id, quantity_on_hand, quantity_reserved)
         values ($1,$2,$3,0)
         on conflict (id) do nothing`,
        [item.inventoryId, item.variantId, item.quantityOnHand]
      );
    }

    for (const [id, productId, name, description, image, pointsPrice, stockQuantity, status, sortOrder] of defaultPointsMallItems()) {
      await client.query(
        `insert into points_mall_items (
          id, product_id, name, description, image, points_price, stock_quantity, status, sort_order
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        on conflict (id) do update set
          name = excluded.name,
          description = excluded.description,
          image = excluded.image,
          points_price = excluded.points_price,
          stock_quantity = excluded.stock_quantity,
          status = excluded.status,
          sort_order = excluded.sort_order,
          updated_at = now()`,
        [id, productId, name, description, image, pointsPrice, stockQuantity, status, sortOrder]
      );
    }

    if (includeAdmin && seedAdminEmail && seedAdminPassword) {
      await client.query(
        `insert into admin_users (id, email, name, password_hash, role, status)
         values ($1,$2,$3,$4,$5,'active')
         on conflict (email) do nothing`,
        [randomUUID(), seedAdminEmail, "Scent Admin", hashPassword(seedAdminPassword), seedAdminRole]
      );
    }

    const counts = await client.query(`
      select
        (select count(*)::int from member_tiers) as member_tiers,
        (select count(*)::int from admin_users) as admin_users,
        (select count(*)::int from points_mall_items) as points_mall_items,
        (select count(*)::int from products) as products
    `);
    return { skipped: false, counts: counts.rows[0] };
  });
}
