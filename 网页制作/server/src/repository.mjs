import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { hasDatabaseUrl, withPgClient, withPgTransaction } from "./db.mjs";

const jsonMutationQueues = new Map();

async function serializeJsonMutation(dataFile, callback) {
  const key = path.resolve(dataFile);
  const previous = jsonMutationQueues.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(callback);
  const settled = current.catch(() => {});
  jsonMutationQueues.set(key, settled);
  try {
    return await current;
  } finally {
    if (jsonMutationQueues.get(key) === settled) jsonMutationQueues.delete(key);
  }
}

export function repositoryMode() {
  return hasDatabaseUrl() ? "postgres" : "json";
}

export function createRepository(options = {}) {
  return repositoryMode() === "postgres"
    ? new PostgresRepository()
    : new JsonRepository(options.dataFile);
}

function iso(value) {
  if (!value) return value ?? null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function numeric(value) {
  return value === null || value === undefined ? value : Number(value);
}

const jsonbColumns = new Set([
  "notes",
  "scenes",
  "mood",
  "status_tags",
  "product_snapshot",
  "raw_payload",
  "payload",
  "item_snapshot",
  "before_data",
  "after_data",
  "response_body"
]);

export function serializePostgresValue(column, value) {
  if (value === null || value === undefined || !jsonbColumns.has(column)) return value;
  return JSON.stringify(value);
}

const specs = [
  {
    key: "memberTiers",
    table: "member_tiers",
    order: "sort_order asc",
    columns: {
      id: "id",
      code: "code",
      name: "name",
      minLifetimePaidAmount: "min_lifetime_paid_amount",
      discountRate: "discount_rate",
      pointMultiplier: "point_multiplier",
      freeShippingThreshold: "free_shipping_threshold_amount",
      sortOrder: "sort_order",
      isActive: "is_active",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    numbers: ["discountRate", "pointMultiplier"],
    dates: ["createdAt", "updatedAt"]
  },
  {
    key: "users",
    table: "users",
    order: "created_at asc",
    columns: {
      id: "id",
      email: "email",
      phone: "phone",
      name: "name",
      passwordHash: "password_hash",
      status: "status",
      emailVerifiedAt: "email_verified_at",
      termsAcceptedAt: "terms_accepted_at",
      termsVersion: "terms_version",
      privacyAcceptedAt: "privacy_accepted_at",
      privacyVersion: "privacy_version",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    dates: ["emailVerifiedAt", "termsAcceptedAt", "privacyAcceptedAt", "createdAt", "updatedAt"]
  },
  {
    key: "adminUsers",
    table: "admin_users",
    order: "created_at asc",
    columns: {
      id: "id",
      email: "email",
      name: "name",
      passwordHash: "password_hash",
      role: "role",
      status: "status",
      lastLoginAt: "last_login_at",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    dates: ["lastLoginAt", "createdAt", "updatedAt"]
  },
  {
    key: "sessions",
    table: "sessions",
    order: "created_at asc",
    columns: {
      id: "id",
      userId: "user_id",
      createdAt: "created_at",
      expiresAt: "expires_at",
      lastSeenAt: "last_seen_at",
      revokedAt: "revoked_at"
    },
    dates: ["createdAt", "expiresAt", "lastSeenAt", "revokedAt"]
  },
  {
    key: "emailVerificationTokens",
    table: "email_verification_tokens",
    order: "created_at asc",
    columns: {
      id: "id", userId: "user_id", tokenHash: "token_hash", expiresAt: "expires_at",
      usedAt: "used_at", createdAt: "created_at"
    },
    dates: ["expiresAt", "usedAt", "createdAt"]
  },
  {
    key: "passwordResetTokens",
    table: "password_reset_tokens",
    order: "created_at asc",
    columns: {
      id: "id", userId: "user_id", tokenHash: "token_hash", expiresAt: "expires_at",
      usedAt: "used_at", createdAt: "created_at"
    },
    dates: ["expiresAt", "usedAt", "createdAt"]
  },
  {
    key: "loginAttempts",
    table: "login_attempts",
    order: "created_at asc",
    columns: {
      id: "id", identityHash: "identity_hash", ipHash: "ip_hash", kind: "kind",
      succeeded: "succeeded", createdAt: "created_at"
    },
    dates: ["createdAt"]
  },
  {
    key: "adminSessions",
    table: "admin_sessions",
    order: "created_at asc",
    columns: {
      id: "id",
      adminUserId: "admin_user_id",
      createdAt: "created_at",
      expiresAt: "expires_at",
      lastSeenAt: "last_seen_at",
      revokedAt: "revoked_at"
    },
    dates: ["createdAt", "expiresAt", "lastSeenAt", "revokedAt"]
  },
  {
    key: "products",
    table: "products",
    order: "sort_order asc, created_at asc",
    columns: {
      id: "id",
      slug: "slug",
      name: "name",
      brandName: "brand_name",
      brandId: "brand_id",
      category: "category",
      country: "country",
      status: "status",
      description: "description",
      volume: "volume",
      concentration: "concentration",
      stockLabel: "stock_label",
      year: "year",
      perfumer: "perfumer",
      family: "family",
      notes: "notes",
      scenes: "scenes",
      mood: "mood",
      sweetness: "sweetness",
      statusTags: "status_tags",
      heroImageUrl: "hero_image_url",
      imageLayout: "image_layout",
      buyerNote: "buyer_note",
      bestFor: "best_for",
      caution: "caution",
      topNotes: "top_notes",
      middleNotes: "middle_notes",
      baseNotes: "base_notes",
      sortOrder: "sort_order",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    dates: ["createdAt", "updatedAt"]
  },
  {
    key: "productVariants",
    table: "product_variants",
    order: "created_at asc",
    columns: {
      id: "id",
      productId: "product_id",
      sku: "sku",
      name: "name",
      priceAmount: "price_amount",
      status: "status",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    dates: ["createdAt", "updatedAt"]
  },
  {
    key: "productImages",
    table: "product_images",
    order: "sort_order asc, created_at asc",
    columns: {
      id: "id",
      productId: "product_id",
      imageUrl: "image_url",
      alt: "alt",
      role: "role",
      sortOrder: "sort_order",
      blobPath: "blob_path",
      contentType: "content_type",
      byteSize: "byte_size",
      createdAt: "created_at"
    },
    dates: ["createdAt"]
  },
  {
    key: "inventoryItems",
    table: "inventory_items",
    order: "created_at asc",
    columns: {
      id: "id",
      variantId: "variant_id",
      quantityOnHand: "quantity_on_hand",
      quantityReserved: "quantity_reserved",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    dates: ["createdAt", "updatedAt"]
  },
  {
    key: "inventoryMovements",
    table: "inventory_movements",
    order: "created_at asc",
    columns: {
      id: "id",
      inventoryItemId: "inventory_item_id",
      quantityDelta: "quantity_delta",
      reason: "reason",
      referenceType: "reference_type",
      referenceId: "reference_id",
      createdAt: "created_at"
    },
    dates: ["createdAt"]
  },
  {
    key: "stockReservations",
    table: "stock_reservations",
    order: "created_at asc",
    columns: {
      id: "id",
      inventoryItemId: "inventory_item_id",
      orderId: "order_id",
      quantity: "quantity",
      status: "status",
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    dates: ["expiresAt", "createdAt", "updatedAt"]
  },
  {
    key: "memberProfiles",
    table: "member_profiles",
    order: "created_at asc",
    columns: {
      userId: "user_id",
      tierId: "tier_id",
      lifetimePaidAmount: "lifetime_paid_amount",
      availablePoints: "available_points",
      birthday: "birthday",
      acceptsMarketing: "accepts_marketing",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    dates: ["birthday", "createdAt", "updatedAt"]
  },
  {
    key: "orders",
    table: "orders",
    order: "created_at asc",
    columns: {
      id: "id",
      orderNo: "order_no",
      userId: "user_id",
      status: "status",
      subtotalAmount: "subtotal_amount",
      productDiscountAmount: "product_discount_amount",
      memberDiscountAmount: "member_discount_amount",
      couponDiscountAmount: "coupon_discount_amount",
      pointsDiscountAmount: "points_discount_amount",
      shippingAmount: "shipping_amount",
      paidAmount: "paid_amount",
      eligiblePaidAmount: "eligible_paid_amount",
      pointsUsed: "points_used",
      pointsAwarded: "points_awarded",
      memberTierId: "member_tier_id",
      paymentProvider: "payment_provider",
      paymentReference: "payment_reference",
      requestId: "request_id",
      paidAt: "paid_at",
      completedAt: "completed_at",
      refundedAt: "refunded_at",
      cancelledAt: "cancelled_at",
      cancellationReason: "cancellation_reason",
      termsAcceptedAt: "terms_accepted_at",
      termsVersion: "terms_version",
      privacyAcceptedAt: "privacy_accepted_at",
      privacyVersion: "privacy_version",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    dates: ["paidAt", "completedAt", "refundedAt", "cancelledAt", "termsAcceptedAt", "privacyAcceptedAt", "createdAt", "updatedAt"]
  },
  {
    key: "addresses",
    table: "addresses",
    order: "created_at asc",
    columns: {
      id: "id", userId: "user_id", recipientName: "recipient_name", recipientPhone: "recipient_phone",
      province: "province", city: "city", district: "district", addressLine: "address_line",
      postalCode: "postal_code", isDefault: "is_default", createdAt: "created_at", updatedAt: "updated_at"
    },
    dates: ["createdAt", "updatedAt"]
  },
  {
    key: "orderAddresses",
    table: "order_addresses",
    order: "created_at asc",
    columns: {
      id: "id", orderId: "order_id", addressType: "address_type", recipientName: "recipient_name",
      recipientPhone: "recipient_phone", province: "province", city: "city", district: "district",
      addressLine: "address_line", postalCode: "postal_code", createdAt: "created_at"
    },
    dates: ["createdAt"]
  },
  {
    key: "shipments",
    table: "shipments",
    order: "created_at asc",
    columns: {
      id: "id", orderId: "order_id", carrier: "carrier", trackingNo: "tracking_no", status: "status",
      shippedAt: "shipped_at", deliveredAt: "delivered_at", createdAt: "created_at", updatedAt: "updated_at"
    },
    dates: ["shippedAt", "deliveredAt", "createdAt", "updatedAt"]
  },
  {
    key: "payments",
    table: "payments",
    order: "created_at asc",
    columns: {
      id: "id", orderId: "order_id", provider: "provider", providerPaymentId: "provider_payment_id",
      status: "status", paymentAmount: "payment_amount", currency: "currency", idempotencyKey: "idempotency_key",
      confirmedByAdminId: "confirmed_by_admin_id", confirmedAt: "confirmed_at", rawPayload: "raw_payload",
      createdAt: "created_at", updatedAt: "updated_at"
    },
    dates: ["confirmedAt", "createdAt", "updatedAt"]
  },
  {
    key: "paymentEvents",
    table: "payment_events",
    order: "created_at asc",
    columns: {
      id: "id", provider: "provider", providerEventId: "provider_event_id", paymentId: "payment_id",
      eventType: "event_type", payload: "payload", createdAt: "created_at"
    },
    dates: ["createdAt"]
  },
  {
    key: "refunds",
    table: "refunds",
    order: "created_at asc",
    columns: {
      id: "id", orderId: "order_id", paymentId: "payment_id", providerRefundId: "provider_refund_id",
      status: "status", refundAmount: "refund_amount", reason: "reason",
      confirmedByAdminId: "confirmed_by_admin_id", confirmedAt: "confirmed_at",
      createdAt: "created_at", updatedAt: "updated_at"
    },
    dates: ["confirmedAt", "createdAt", "updatedAt"]
  },
  {
    key: "refundEvents",
    table: "refund_events",
    order: "created_at asc",
    columns: {
      id: "id", provider: "provider", providerEventId: "provider_event_id", refundId: "refund_id",
      eventType: "event_type", payload: "payload", createdAt: "created_at"
    },
    dates: ["createdAt"]
  },
  {
    key: "orderItems",
    table: "order_items",
    order: "created_at asc",
    columns: {
      id: "id",
      orderId: "order_id",
      productId: "product_id",
      variantId: "variant_id",
      productName: "product_name",
      brandName: "brand_name",
      sku: "sku",
      unitPrice: "unit_price_amount",
      quantity: "quantity",
      subtotalAmount: "subtotal_amount",
      discountAmount: "discount_amount",
      memberDiscountExcluded: "member_discount_excluded",
      productSnapshot: "product_snapshot",
      createdAt: "created_at"
    },
    dates: ["createdAt"]
  },
  {
    key: "tierHistory",
    table: "tier_history",
    order: "created_at asc",
    columns: {
      id: "id",
      userId: "user_id",
      fromTierId: "from_tier_id",
      toTierId: "to_tier_id",
      reason: "reason",
      orderId: "order_id",
      createdAt: "created_at"
    },
    dates: ["createdAt"]
  },
  {
    key: "pointsMallItems",
    table: "points_mall_items",
    order: "sort_order asc",
    columns: {
      id: "id",
      productId: "product_id",
      name: "name",
      description: "description",
      image: "image",
      pointsPrice: "points_price",
      stockQuantity: "stock_quantity",
      status: "status",
      sortOrder: "sort_order",
      startsAt: "starts_at",
      endsAt: "ends_at",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    dates: ["startsAt", "endsAt", "createdAt", "updatedAt"]
  },
  {
    key: "pointsRedemptionOrders",
    table: "points_redemption_orders",
    order: "created_at asc",
    columns: {
      id: "id",
      orderNo: "order_no",
      userId: "user_id",
      status: "status",
      totalPoints: "total_points",
      recipientName: "recipient_name",
      recipientPhone: "recipient_phone",
      shippingAddress: "shipping_address",
      trackingNo: "tracking_no",
      requestId: "request_id",
      shippedAt: "shipped_at",
      completedAt: "completed_at",
      cancelledAt: "cancelled_at",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    dates: ["shippedAt", "completedAt", "cancelledAt", "createdAt", "updatedAt"]
  },
  {
    key: "pointsRedemptionItems",
    table: "points_redemption_items",
    order: "created_at asc",
    columns: {
      id: "id",
      redemptionOrderId: "redemption_order_id",
      mallItemId: "mall_item_id",
      productId: "product_id",
      name: "name",
      pointsPrice: "points_price",
      quantity: "quantity",
      subtotalPoints: "subtotal_points",
      itemSnapshot: "item_snapshot",
      createdAt: "created_at"
    },
    dates: ["createdAt"]
  },
  {
    key: "pointTransactions",
    table: "point_transactions",
    order: "created_at asc",
    columns: {
      id: "id",
      userId: "user_id",
      orderId: "order_id",
      redemptionOrderId: "redemption_order_id",
      sourceTransactionId: "source_transaction_id",
      type: "type",
      points: "points",
      balanceAfter: "balance_after",
      expiresAt: "expires_at",
      note: "note",
      createdAt: "created_at"
    },
    dates: ["expiresAt", "createdAt"]
  },
  {
    key: "coupons",
    table: "coupons",
    order: "created_at asc",
    columns: {
      id: "id",
      code: "code",
      name: "name",
      discountType: "discount_type",
      discountAmount: "discount_amount",
      minOrderAmount: "min_order_amount",
      status: "status",
      startsAt: "starts_at",
      endsAt: "ends_at",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    dates: ["startsAt", "endsAt", "createdAt", "updatedAt"]
  },
  {
    key: "couponRedemptions",
    table: "coupon_redemptions",
    order: "created_at asc",
    columns: {
      id: "id",
      couponId: "coupon_id",
      userId: "user_id",
      orderId: "order_id",
      discountAmount: "discount_amount",
      createdAt: "created_at"
    },
    dates: ["createdAt"]
  },
  {
    key: "operationLogs",
    table: "operation_logs",
    order: "created_at asc",
    columns: {
      id: "id",
      actor: "actor",
      actorAdminId: "actor_admin_id",
      actorName: "actor_name",
      actorEmail: "actor_email",
      actorRole: "actor_role",
      action: "action",
      entityType: "entity_type",
      entityId: "entity_id",
      before: "before_data",
      after: "after_data",
      reason: "reason",
      createdAt: "created_at"
    },
    dates: ["createdAt"]
  },
  {
    key: "idempotencyKeys",
    table: "idempotency_keys",
    order: "created_at asc",
    columns: {
      id: "id", key: "key", scope: "scope", requestHash: "request_hash", responseBody: "response_body",
      responseStatus: "response_status", lockedUntil: "locked_until", createdAt: "created_at", updatedAt: "updated_at"
    },
    dates: ["lockedUntil", "createdAt", "updatedAt"]
  },
  {
    key: "emailDeliveries",
    table: "email_deliveries",
    order: "created_at asc",
    columns: {
      id: "id", userId: "user_id", kind: "kind", recipient: "recipient", idempotencyKey: "idempotency_key",
      providerMessageId: "provider_message_id", status: "status", errorMessage: "error_message",
      createdAt: "created_at", updatedAt: "updated_at"
    },
    dates: ["createdAt", "updatedAt"]
  }
];

const deleteOrder = [
  "email_deliveries",
  "idempotency_keys",
  "refund_events",
  "refunds",
  "payment_events",
  "payments",
  "shipments",
  "order_addresses",
  "addresses",
  "password_reset_tokens",
  "email_verification_tokens",
  "login_attempts",
  "stock_reservations",
  "inventory_movements",
  "inventory_items",
  "product_images",
  "product_variants",
  "coupon_redemptions",
  "coupons",
  "points_redemption_items",
  "point_transactions",
  "points_redemption_orders",
  "points_mall_items",
  "order_items",
  "tier_history",
  "orders",
  "member_profiles",
  "admin_sessions",
  "sessions",
  "operation_logs",
  "products",
  "admin_users",
  "users",
  "member_tiers"
];

const writeOrder = [
  "memberTiers",
  "users",
  "adminUsers",
  "sessions",
  "adminSessions",
  "emailVerificationTokens",
  "passwordResetTokens",
  "loginAttempts",
  "products",
  "productVariants",
  "productImages",
  "inventoryItems",
  "inventoryMovements",
  "stockReservations",
  "memberProfiles",
  "orders",
  "orderItems",
  "addresses",
  "orderAddresses",
  "shipments",
  "payments",
  "paymentEvents",
  "refunds",
  "refundEvents",
  "tierHistory",
  "pointsMallItems",
  "pointsRedemptionOrders",
  "pointTransactions",
  "pointsRedemptionItems",
  "coupons",
  "couponRedemptions",
  "operationLogs",
  "idempotencyKeys",
  "emailDeliveries"
];

const specsByKey = Object.fromEntries(specs.map((spec) => [spec.key, spec]));

function fromRow(spec, row) {
  const item = {};
  Object.entries(spec.columns).forEach(([jsonKey, sqlKey]) => {
    let value = row[sqlKey];
    if (spec.numbers?.includes(jsonKey)) value = numeric(value);
    if (spec.dates?.includes(jsonKey)) value = iso(value);
    item[jsonKey] = value;
  });
  return item;
}

function toRow(spec, item) {
  return Object.entries(spec.columns).map(([jsonKey, sqlKey]) => (
    serializePostgresValue(sqlKey, item?.[jsonKey] ?? null)
  ));
}

export class JsonRepository {
  constructor(dataFile = process.env.MEMBER_DB || path.resolve("server/data/db.json")) {
    this.dataFile = dataFile;
  }

  async read() {
    if (!existsSync(this.dataFile)) return {};
    return JSON.parse(await readFile(this.dataFile, "utf8"));
  }

  async writeUnlocked(db) {
    await mkdir(path.dirname(this.dataFile), { recursive: true });
    const temporaryFile = `${this.dataFile}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(db, null, 2));
    await rename(temporaryFile, this.dataFile);
    return db;
  }

  async write(db) {
    return serializeJsonMutation(this.dataFile, () => this.writeUnlocked(db));
  }

  async readCollections(names) {
    const db = await this.read();
    return Object.fromEntries(names.map((name) => [name, Array.isArray(db[name]) ? db[name] : []]));
  }

  async getCollection(name) {
    const db = await this.read();
    return Array.isArray(db[name]) ? db[name] : [];
  }

  async saveCollection(name, rows) {
    await this.mutate((db) => {
      db[name] = rows;
    });
    return rows;
  }

  async transaction(callback) {
    return serializeJsonMutation(this.dataFile, async () => {
      const db = await this.read();
      const next = await callback(db);
      await this.writeUnlocked(next || db);
      return next || db;
    });
  }

  async mutate(callback) {
    return serializeJsonMutation(this.dataFile, async () => {
      const db = await this.read();
      const result = await callback(db);
      await this.writeUnlocked(db);
      return result;
    });
  }
}

export class PostgresRepository {
  async query(sql, params = []) {
    return withPgClient((client) => client.query(sql, params));
  }

  async readWithClient(client, { lock = false } = {}) {
    const db = {};
    for (const spec of specs) {
      const result = await client.query(`select * from ${spec.table} order by ${spec.order}${lock ? " for update" : ""}`);
      db[spec.key] = result.rows.map((row) => fromRow(spec, row));
    }
    return db;
  }

  async read() {
    return withPgClient((client) => this.readWithClient(client));
  }

  async readCollections(names) {
    const requested = [...new Set(names)];
    for (const name of requested) {
      if (!specsByKey[name]) throw new TypeError(`Unknown repository collection: ${name}`);
    }
    return withPgClient(async (client) => {
      const db = {};
      for (const name of requested) {
        const spec = specsByKey[name];
        const result = await client.query(`select * from ${spec.table} order by ${spec.order}`);
        db[name] = result.rows.map((row) => fromRow(spec, row));
      }
      return db;
    });
  }

  async write(db) {
    return this.transaction(async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtext('scent_atoll_state_write'))");
      const previousDb = await this.readWithClient(client, { lock: true });
      await this.syncState(client, db, previousDb);
      return db;
    });
  }

  async upsertMappedRow(client, spec, item) {
    const columns = Object.values(spec.columns);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const primaryColumn = spec.key === "memberProfiles" ? "user_id" : "id";
    const updates = columns
      .filter((column) => column !== primaryColumn)
      .map((column) => `${column} = excluded.${column}`);
    await client.query(
      `insert into ${spec.table} (${columns.join(", ")}) values (${placeholders.join(", ")})
       on conflict (${primaryColumn}) do update set ${updates.join(", ")}`,
      toRow(spec, item)
    );
  }

  async syncState(client, db, previousDb = {}) {
    for (const key of writeOrder) {
      const spec = specsByKey[key];
      const rows = Array.isArray(db[key]) ? db[key] : [];
      const primaryJsonKey = key === "memberProfiles" ? "userId" : "id";
      const previousRows = Array.isArray(previousDb[key]) ? previousDb[key] : [];
      const previousById = new Map(previousRows.map((row) => [row[primaryJsonKey], row]));
      for (const row of rows) {
        const previous = previousById.get(row[primaryJsonKey]);
        if (!previous || !isDeepStrictEqual(toRow(spec, previous), toRow(spec, row))) {
          await this.upsertMappedRow(client, spec, row);
        }
      }
    }
    for (const table of deleteOrder) {
      const spec = specs.find((item) => item.table === table);
      const rows = Array.isArray(db[spec.key]) ? db[spec.key] : [];
      const previousRows = Array.isArray(previousDb[spec.key]) ? previousDb[spec.key] : [];
      const primaryJsonKey = spec.key === "memberProfiles" ? "userId" : "id";
      const primaryColumn = spec.key === "memberProfiles" ? "user_id" : "id";
      const currentIds = new Set(rows.map((row) => row[primaryJsonKey]).filter(Boolean));
      const removedIds = previousRows
        .map((row) => row[primaryJsonKey])
        .filter((id) => id && !currentIds.has(id));
      if (removedIds.length) await client.query(`delete from ${table} where ${primaryColumn} = any($1::text[])`, [removedIds]);
    }
  }

  async mutate(callback) {
    return this.transaction(async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtext('scent_atoll_state_write'))");
      const db = await this.readWithClient(client, { lock: true });
      const previousDb = structuredClone(db);
      const result = await callback(db);
      await this.syncState(client, db, previousDb);
      return result;
    });
  }

  async transaction(callback) {
    return withPgTransaction(callback);
  }

  async getCollection(name) {
    return (await this.read())[name] || [];
  }

  async saveCollection(name, rows) {
    const db = await this.read();
    db[name] = rows;
    await this.write(db);
    return rows;
  }

  async listMemberTiers() {
    return this.getCollection("memberTiers");
  }

  async findUserById(id) {
    const result = await this.query("select * from users where id = $1", [id]);
    return result.rows[0] || null;
  }

  async findUserByEmail(email) {
    const result = await this.query("select * from users where email = $1", [String(email).toLowerCase()]);
    return result.rows[0] || null;
  }

  async findMemberProfile(userId) {
    const result = await this.query("select * from member_profiles where user_id = $1", [userId]);
    return result.rows[0] || null;
  }

  async findAdminByEmail(email) {
    const result = await this.query("select * from admin_users where email = $1", [String(email).toLowerCase()]);
    return result.rows[0] || null;
  }

  async findOrderById(id) {
    const result = await this.query("select * from orders where id = $1", [id]);
    return result.rows[0] || null;
  }

  async listOrders(limit = 100) {
    const result = await this.query("select * from orders order by created_at desc limit $1", [limit]);
    return result.rows;
  }

  async listPointTransactionsForUser(userId) {
    const result = await this.query("select * from point_transactions where user_id = $1 order by created_at desc", [userId]);
    return result.rows;
  }

  async listPointsMallItems() {
    return this.getCollection("pointsMallItems");
  }

  async listOperationLogs(limit = 200) {
    const result = await this.query("select * from operation_logs order by created_at desc limit $1", [limit]);
    return result.rows;
  }

  async insertOperationLog(log) {
    const db = await this.read();
    db.operationLogs.push(log);
    await this.write(db);
    return log;
  }

  async findProductBySlug(slug) {
    const result = await this.query("select * from products where slug = $1", [slug]);
    return result.rows[0] || null;
  }
}
