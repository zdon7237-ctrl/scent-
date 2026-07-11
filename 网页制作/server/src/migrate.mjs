import { hasDatabaseUrl, withPgClient } from "./db.mjs";

export const migrationId = "003_commercial_transaction_hardening";
const commercialFoundationMigrationId = "002_commercial_launch_foundation";
const legacyMigrationId = "001_initial_postgres_foundation";

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

alter table users add column if not exists email_verified_at timestamptz;

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table sessions add column if not exists last_seen_at timestamptz;
alter table sessions add column if not exists revoked_at timestamptz;

create table if not exists email_verification_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists password_reset_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists login_attempts (
  id text primary key,
  identity_hash text not null,
  ip_hash text,
  kind text not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_identity_created_idx on login_attempts(identity_hash, created_at desc);

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
alter table admin_sessions add column if not exists revoked_at timestamptz;

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

alter table products add column if not exists brand_id text;
alter table products add column if not exists category text;
alter table products add column if not exists country text;
alter table products add column if not exists volume text;
alter table products add column if not exists concentration text;
alter table products add column if not exists stock_label text;
alter table products add column if not exists year text;
alter table products add column if not exists perfumer text;
alter table products add column if not exists family text;
alter table products add column if not exists notes jsonb not null default '[]'::jsonb;
alter table products add column if not exists scenes jsonb not null default '[]'::jsonb;
alter table products add column if not exists mood jsonb not null default '[]'::jsonb;
alter table products add column if not exists sweetness text;
alter table products add column if not exists status_tags jsonb not null default '[]'::jsonb;
alter table products add column if not exists hero_image_url text;
alter table products add column if not exists image_layout text not null default 'grid';
alter table products add column if not exists buyer_note text;
alter table products add column if not exists best_for text;
alter table products add column if not exists caution text;
alter table products add column if not exists top_notes text;
alter table products add column if not exists middle_notes text;
alter table products add column if not exists base_notes text;
alter table products add column if not exists sort_order integer not null default 0;

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

alter table product_images add column if not exists role text not null default 'gallery';
alter table product_images add column if not exists blob_path text;
alter table product_images add column if not exists content_type text;
alter table product_images add column if not exists byte_size integer;

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
create unique index if not exists stock_reservations_active_order_inventory_idx
  on stock_reservations(order_id, inventory_item_id) where status = 'active';

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

alter table orders add column if not exists request_id text;
alter table orders add column if not exists cancelled_at timestamptz;
alter table orders add column if not exists cancellation_reason text;
create unique index if not exists orders_user_request_idx on orders(user_id, request_id) where request_id is not null;

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

alter table addresses add column if not exists province text;
alter table addresses add column if not exists city text;
alter table addresses add column if not exists district text;
alter table addresses add column if not exists is_default boolean not null default false;

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

alter table order_addresses add column if not exists province text;
alter table order_addresses add column if not exists city text;
alter table order_addresses add column if not exists district text;

create table if not exists shipments (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  carrier text not null,
  tracking_no text not null,
  status text not null default 'shipped',
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (carrier, tracking_no)
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

alter table payments add column if not exists idempotency_key text;
alter table payments add column if not exists confirmed_by_admin_id text references admin_users(id) on delete set null;
alter table payments add column if not exists confirmed_at timestamptz;
alter table payments add column if not exists raw_payload jsonb;
create unique index if not exists payments_provider_idempotency_idx
  on payments(provider, idempotency_key) where idempotency_key is not null;

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

alter table idempotency_keys add column if not exists response_status integer;

create table if not exists email_deliveries (
  id text primary key,
  user_id text references users(id) on delete set null,
  kind text not null,
  recipient text not null,
  idempotency_key text not null unique,
  provider_message_id text,
  status text not null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
`;

export const hardeningMigrationSql = `
alter table users add column if not exists terms_accepted_at timestamptz;
alter table users add column if not exists terms_version text;
alter table users add column if not exists privacy_accepted_at timestamptz;
alter table users add column if not exists privacy_version text;

alter table orders add column if not exists terms_accepted_at timestamptz;
alter table orders add column if not exists terms_version text;
alter table orders add column if not exists privacy_accepted_at timestamptz;
alter table orders add column if not exists privacy_version text;

alter table refunds add column if not exists confirmed_by_admin_id text references admin_users(id) on delete set null;
alter table refunds add column if not exists confirmed_at timestamptz;

create unique index if not exists inventory_items_variant_idx on inventory_items(variant_id);
create unique index if not exists shipments_order_idx on shipments(order_id);
create unique index if not exists order_addresses_order_type_idx on order_addresses(order_id, address_type);
create unique index if not exists payments_order_succeeded_idx on payments(order_id) where status = 'succeeded';
create unique index if not exists refunds_order_active_idx on refunds(order_id) where status in ('processing', 'succeeded');
create unique index if not exists refunds_provider_reference_idx on refunds(provider_refund_id) where provider_refund_id is not null;
create unique index if not exists point_transactions_order_lifecycle_idx
  on point_transactions(order_id, type)
  where order_id is not null and type in ('earn_order', 'refund_reversal');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inventory_items_nonnegative_check') then
    alter table inventory_items add constraint inventory_items_nonnegative_check
      check (quantity_on_hand >= 0 and quantity_reserved >= 0 and quantity_reserved <= quantity_on_hand) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stock_reservations_quantity_check') then
    alter table stock_reservations add constraint stock_reservations_quantity_check check (quantity > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_quantity_amount_check') then
    alter table order_items add constraint order_items_quantity_amount_check
      check (quantity > 0 and unit_price_amount >= 0 and subtotal_amount >= 0 and discount_amount >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_amount_check') then
    alter table payments add constraint payments_amount_check check (payment_amount >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'refunds_amount_check') then
    alter table refunds add constraint refunds_amount_check check (refund_amount > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'points_mall_inventory_check') then
    alter table points_mall_items add constraint points_mall_inventory_check
      check (points_price > 0 and stock_quantity >= 0) not valid;
  end if;
end $$;
`;

export async function migrate() {
  if (!hasDatabaseUrl()) {
    return { skipped: true, reason: "DATABASE_URL is not set." };
  }

  return withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(migrationSql);
      await client.query(hardeningMigrationSql);
      await client.query("insert into schema_migrations (id) values ($1) on conflict (id) do nothing", [legacyMigrationId]);
      await client.query("insert into schema_migrations (id) values ($1) on conflict (id) do nothing", [commercialFoundationMigrationId]);
      await client.query("insert into schema_migrations (id) values ($1) on conflict (id) do nothing", [migrationId]);
      await client.query("COMMIT");
      return { skipped: false, migrationId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}
