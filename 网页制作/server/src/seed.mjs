import { randomUUID, scryptSync } from "node:crypto";
import { hasDatabaseUrl, withPgTransaction } from "./db.mjs";

const defaultSeedAdminPassword = ["dev", "admin"].join("-");

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

export async function seed() {
  if (!hasDatabaseUrl()) {
    return { skipped: true, reason: "DATABASE_URL is not set." };
  }

  const isProduction = process.env.NODE_ENV === "production";
  const seedAdminEmail = String(process.env.SEED_ADMIN_EMAIL || "admin@scent.local").trim().toLowerCase();
  const seedAdminPassword = String(process.env.SEED_ADMIN_PASSWORD || (isProduction ? "" : defaultSeedAdminPassword));
  const seedAdminRole = String(process.env.SEED_ADMIN_ROLE || "owner").trim().toLowerCase();

  if (isProduction && (!process.env.SEED_ADMIN_PASSWORD || seedAdminPassword === defaultSeedAdminPassword)) {
    throw new Error("生产环境不能使用默认 seed 管理员密码。");
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

    await client.query(
      `insert into products (
        id, slug, name, brand_name, brand_id, category, country, status, description,
        volume, concentration, stock_label, family, notes, scenes, sweetness,
        status_tags, hero_image_url, image_layout, buyer_note, best_for, caution,
        top_notes, middle_notes, base_notes, sort_order
       )
       values (
        $1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,
        $16::jsonb,$17,$18,$19,$20,$21,$22,$23,$24,$25
       )
       on conflict (slug) do update set
        name = excluded.name,
        brand_name = excluded.brand_name,
        brand_id = excluded.brand_id,
        category = excluded.category,
        country = excluded.country,
        description = excluded.description,
        volume = excluded.volume,
        concentration = excluded.concentration,
        stock_label = excluded.stock_label,
        family = excluded.family,
        notes = excluded.notes,
        scenes = excluded.scenes,
        sweetness = excluded.sweetness,
        status_tags = excluded.status_tags,
        hero_image_url = excluded.hero_image_url,
        image_layout = excluded.image_layout,
        buyer_note = excluded.buyer_note,
        best_for = excluded.best_for,
        caution = excluded.caution,
        top_notes = excluded.top_notes,
        middle_notes = excluded.middle_notes,
        base_notes = excluded.base_notes,
        sort_order = excluded.sort_order,
        updated_at = now()`,
      [
        "product-vespree",
        "vespree",
        "Vespree 晚霞之约",
        "Maison Bienaime",
        "bienaime",
        "fragrance",
        "France",
        "木质花香，适合想要一支有礼貌但不普通的通勤香。",
        "75ml",
        "EDP",
        "现货",
        "木质花香",
        JSON.stringify(["木质", "花香", "辛香"]),
        JSON.stringify(["daily", "date", "gift"]),
        "medium",
        JSON.stringify(["New", "买手推荐"]),
        "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=1200&q=82",
        "editorial",
        "木质和树脂把整体压得更稳，适合办公室、晚餐和送礼。",
        "办公室、晚餐、送礼",
        "如果只喜欢非常清爽的柑橘，可能会觉得后调偏暖。",
        "豆蔻、佛手柑、薰衣草、胡萝卜籽",
        "秘鲁香脂、玫瑰、天竺葵、鸢尾",
        "香根草、安息香、香草、雪松、檀香",
        1
      ]
    );

    await client.query(
      `insert into product_variants (id, product_id, sku, name, price_amount, status)
       values ($1,$2,$3,$4,$5,'active')
       on conflict (sku) do update set
        name = excluded.name,
        price_amount = excluded.price_amount,
        updated_at = now()`,
      ["variant-vespree-default", "product-vespree", "vespree-default", "默认规格", 98000]
    );

    await client.query(
      `insert into product_images (id, product_id, image_url, alt, role, sort_order)
       values ($1,$2,$3,$4,'hero',1)
       on conflict (id) do update set
        image_url = excluded.image_url,
        alt = excluded.alt,
        role = excluded.role,
        sort_order = excluded.sort_order`,
      [
        "image-vespree-hero",
        "product-vespree",
        "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=1200&q=82",
        "Vespree 晚霞之约商品图"
      ]
    );

    await client.query(
      `insert into inventory_items (id, variant_id, quantity_on_hand, quantity_reserved)
       values ($1,$2,$3,0)
       on conflict (id) do update set
        quantity_on_hand = greatest(inventory_items.quantity_on_hand, excluded.quantity_on_hand),
        updated_at = now()`,
      ["inventory-vespree-default", "variant-vespree-default", 12]
    );

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

    if (seedAdminEmail && seedAdminPassword) {
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
