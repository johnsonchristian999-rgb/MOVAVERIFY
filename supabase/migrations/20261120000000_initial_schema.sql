create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Mova Verify User',
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_naira bigint not null default 0 check (balance_naira >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog (
  country_code text primary key check (country_code ~ '^[A-Z]{2}$'),
  active boolean not null default false,
  services jsonb not null default '[]'::jsonb,
  pricing jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country_code text not null,
  service text not null,
  tier text not null,
  price_naira bigint not null check (price_naira >= 0),
  status text not null default 'provisioning',
  phone_number text,
  provider_sid text,
  created_at timestamptz not null default now(),
  provisioned_at timestamptz
);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  amount_naira bigint not null check (amount_naira > 0),
  reference text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  reference text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  amount_naira bigint not null check (amount_naira >= 500),
  amount_kobo bigint not null,
  status text not null default 'initialized',
  created_at timestamptz not null default now(),
  credited_at timestamptz
);

create table if not exists public.messages (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  sender text,
  recipient text,
  body text not null,
  received_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists transactions_user_created_idx on public.transactions (user_id, created_at desc);
create index if not exists messages_user_received_idx on public.messages (user_id, received_at desc);

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.catalog enable row level security;
alter table public.orders enable row level security;
alter table public.transactions enable row level security;
alter table public.payments enable row level security;
alter table public.messages enable row level security;

create policy "users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "users read own wallet" on public.wallets for select using (auth.uid() = user_id);
create policy "authenticated users read active catalog" on public.catalog for select using (auth.role() = 'authenticated' and active = true);
create policy "users read own orders" on public.orders for select using (auth.uid() = user_id);
create policy "users read own transactions" on public.transactions for select using (auth.uid() = user_id);
create policy "users read own payments" on public.payments for select using (auth.uid() = user_id);
create policy "users read own messages" on public.messages for select using (auth.uid() = user_id);

insert into public.catalog (country_code, active, services, pricing) values
  ('US', false, '["WhatsApp", "Telegram", "Google", "Facebook"]'::jsonb, '{"WhatsApp":{"Economy":2000,"Standard":2500,"Premium":3500}}'::jsonb),
  ('GB', false, '["WhatsApp", "Telegram", "Google", "Facebook"]'::jsonb, '{"WhatsApp":{"Economy":2560,"Standard":3200,"Premium":4480}}'::jsonb),
  ('CA', false, '["WhatsApp", "Telegram", "Google", "Facebook"]'::jsonb, '{"WhatsApp":{"Economy":2320,"Standard":2900,"Premium":4060}}'::jsonb),
  ('DE', false, '["WhatsApp", "Telegram", "Google", "Facebook"]'::jsonb, '{"WhatsApp":{"Economy":2800,"Standard":3500,"Premium":4900}}'::jsonb)
on conflict (country_code) do nothing;
