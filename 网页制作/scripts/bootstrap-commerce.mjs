import { loadProductionEnv } from "./load-env.mjs";
import { hasDatabaseUrl, withPgClient } from "../server/src/db.mjs";
import { seed } from "../server/src/seed.mjs";

loadProductionEnv();

if (!hasDatabaseUrl()) throw new Error("DATABASE_URL is required.");
if (String(process.env.BOOTSTRAP_COMMERCE_CONFIRM || "").trim() !== "initialize-commerce-data") {
  throw new Error("BOOTSTRAP_COMMERCE_CONFIRM must equal initialize-commerce-data.");
}

const counts = await withPgClient(async (client) => {
  const result = await client.query(`
    select
      (select count(*)::int from member_tiers) as member_tiers,
      (select count(*)::int from products) as products,
      (select count(*)::int from points_mall_items) as points_mall_items
  `);
  return result.rows[0];
});

if (counts.member_tiers || counts.products || counts.points_mall_items) {
  throw new Error("Commerce data already exists; the one-time bootstrap will not overwrite live catalog, tier, or points inventory data.");
}

const result = await seed({ includeAdmin: false });
console.log(`Commerce data initialized: ${JSON.stringify(result.counts)}. Remove BOOTSTRAP_COMMERCE_CONFIRM now.`);
