create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create policy "admins read admin membership" on public.admin_users
  for select using (user_id = auth.uid());
create policy "admins read all profiles" on public.profiles
  for select using (public.is_admin());
create policy "admins read all wallets" on public.wallets
  for select using (public.is_admin());
create policy "admins manage catalog" on public.catalog
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admins read all orders" on public.orders
  for select using (public.is_admin());
create policy "admins read all transactions" on public.transactions
  for select using (public.is_admin());
create policy "admins read all payments" on public.payments
  for select using (public.is_admin());
create policy "admins read all messages" on public.messages
  for select using (public.is_admin());
create policy "admins read all support tickets" on public.support_tickets
  for select using (public.is_admin());
create policy "admins update support tickets" on public.support_tickets
  for update using (public.is_admin()) with check (public.is_admin());

insert into public.admin_users (user_id)
select id from auth.users where lower(email) = 'johnsonchristian999@gmail.com'
on conflict (user_id) do nothing;
