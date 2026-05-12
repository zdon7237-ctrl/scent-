import { hasDatabaseUrl, withPgClient } from "./db.mjs";

export const migrationId = "001_initial_postgres_foundation";

export const migrationSql = `
create table if not exists schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  email text unique,
  phone text unique,
  name text,
  password_hash text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists admin_users (
  id text primary key,
  email text not null unique,
  name text,
  password_hash text not null,
  role text not null,
  status text not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_sessions (
  id text primary key,
  admin_user_id text not null references admin_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz
);

create table if not exists operation_logs (
  id text primary key,
  actor text,
  actor_admin_id text references admin_users(id) on delete set null,
  actor_name text,
  actor_email text,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists member_tiers (
  id text primary key,
  code text not null unique,
  name text not null,
  min_lifetime_paid_amount integer not null default 0,
  discount_rate numeric(5,4) not null default 1,
  point_multiplier numeric(8,4) not null default 1,
  free_shipping_threshold_amount integer not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists member_profiles (
  user_id text primary key references users(id) on delete cascade,
  tier_id text references member_tiers(id),
  lifetime_paid_amount integer not null default 0,
  available_points integer not null default 0,
  birthday date,
  accepts_marketing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tier_history (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  from_tier_id text references member_tiers(id),
  to_tier_id text references member_tiers(id),
  reason text not null,
  order_id text,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id text primary key,
  slug text not null unique,
  name text not null,
  brand_name text,
  status text not null default 'active',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_variants (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  sku text unique,
  name text not null,
  price_amount integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_images (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  image_url text not null,
  alt text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists inventory_items (
  id text primary key,
  variant_id text not null references product_variants(id) on delete cascade,
  quantity_on_hand integer not null default 0,
  quantity_reserved integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id text primary key,
  inventory_item_id text not null references inventory_items(id) on delete cascade,
  quantity_delta integer not null,
  reason text not null,
  reference_type text,
  reference_id text,
  created_at timestamptz not null default now()
);

create table if not exists stock_reservations (
  id text primary key,
  inventory_item_id text not null references inventory_items(id) on delete cascade,
  order_id text,
  quantity integer not null,
  status text not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id text primary key,
  order_no text not null unique,
  user_id text references users(id),
  status text not null,
  subtotal_amount integer not null default 0,
  product_discount_amount integer not null default 0,
  member_discount_amount integer not null default 0,
  coupon_discount_amount integer not null default 0,
  points_discount_amount integer not null default 0,
  shipping_amount integer not null default 0,
  paid_amount integer not null default 0,
  eligible_paid_amount integer not null default 0,
  points_used integer not null default 0,
  points_awarded integer not null default 0,
  member_tier_id text references member_tiers(id),
  payment_provider text,
  payment_reference text,
  paid_at timestamptz,
  completed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  product_id text,
  variant_id text,
  product_name text not null,
  brand_name text,
  sku text,
  unit_price_amount integer not null default 0,
  quantity integer not null,
  subtotal_amount integer not null default 0,
  discount_amount integer not null default 0,
  member_discount_excluded boolean not null default false,
  product_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table if not exists addresses (
  id text primary key,
  user_id text references users(id) on delete cascade,
  recipient_name text not null,
  recipient_phone text not null,
  address_line text not null,
  postal_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_addresses (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  address_type text not null,
  recipient_name text not null,
  recipient_phone text not null,
  address_line text not null,
  postal_code text,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  status text not null,
  payment_amount integer not null,
  currency text not null default 'CNY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_events (
  id text primary key,
  provider text not null,
  provider_event_id text not null,
  payment_id text references payments(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists refunds (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  payment_id text references payments(id) on delete set null,
  provider_refund_id text,
  status text not null,
  refund_amount integer not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists refund_events (
  id text primary key,
  provider text not null,
  provider_event_id text not null,
  refund_id text references refunds(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists point_transactions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  order_id text references orders(id) on delete set null,
  redemption_order_id text,
  source_transaction_id text references point_transactions(id) on delete set null,
  type text not null,
  points integer not null,
  balance_after integer not null,
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists points_mall_items (
  id text primary key,
  product_id text,
  name text not null,
  description text,
  image text,
  points_price integer not null,
  stock_quantity integer not null default 0,
  status text not null default 'draft',
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists points_redemption_orders (
  id text primary key,
  order_no text not null unique,
  user_id text not null references users(id) on delete cascade,
  status text not null,
  total_points integer not null,
  recipient_name text,
  recipient_phone text,
  shipping_address text,
  tracking_no text,
  request_id text,
  shipped_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create table if not exists points_redemption_items (
  id text primary key,
  redemption_order_id text not null references points_redemption_orders(id) on delete cascade,
  mall_item_id text references points_mall_items(id) on delete set null,
  product_id text,
  name text not null,
  points_price integer not null,
  quantity integer not null,
  subtotal_points integer not null,
  item_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table if not exists coupons (
  id text primary key,
  code text not null unique,
  name text not null,
  discount_type text not null,
  discount_amount integer not null default 0,
  min_order_amount integer not null default 0,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists coupon_redemptions (
  id text primary key,
  coupon_id text not null references coupons(id) on delete cascade,
  user_id text references users(id) on delete set null,
  order_id text references orders(id) on delete set null,
  discount_amount integer not null default 0,
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create table if not exists idempotency_keys (
  id text primary key,
  key text not null,
  scope text not null,
  request_hash text,
  response_body jsonb,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, key)
);
`;

export async function migrate() {
  if (!hasDatabaseUrl()) {
    return { skipped: true, reason: "DATABASE_URL is not set." };
  }

  return withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(migrationSql);
      await client.query("insert into schema_migrations (id) values ($1) on conflict (id) do nothing", [migrationId]);
      await client.query("COMMIT");
      return { skipped: false, migrationId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}
